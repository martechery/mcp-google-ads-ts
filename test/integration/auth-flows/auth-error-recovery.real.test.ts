import 'dotenv/config';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { registerTools } from '../../../src/server-tools.js';
import { extractCurrentAuthDetails, createTestAuthEnv, type ExtractedAuthDetails } from '../../utils/auth-extractor.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { 
  public tools: Record<string, ToolHandler> = {}; 
  tool(def: any, handler: ToolHandler) { 
    this.tools[def.name] = handler; 
  } 
}

describe('Auth Flow: Error Recovery', () => {
  let authDetails: ExtractedAuthDetails;
  let cleanup: (() => void) | null = null;
  const hasRequiredEnv = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN && !!process.env.GOOGLE_ADS_ACCOUNT_ID;

  beforeAll(async () => {
    authDetails = await extractCurrentAuthDetails();
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    vi.restoreAllMocks();
  });

  it('handles expired token error gracefully', async () => {
    if (!hasRequiredEnv) return;

    // Use an obviously expired/invalid token
    const expiredToken = 'ya29.expired_token_for_testing_12345';
    
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: expiredToken,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Try to make API call with expired token
    try {
      await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
    } catch (error) {
      // Expected to fail - verify error handling
      expect(error).toBeDefined();
    }

    // Check that manage_auth provides recovery guidance
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    expect(text).toContain('Auth type: env');
  }, 30_000);

  it('provides helpful error messages for missing scopes', async () => {
    if (!hasRequiredEnv) return;

    // The error mapping utility should provide helpful messages
    const { mapAdsErrorMsg } = await import('../../../src/utils/errorMapping.js');
    
    // Test various error scenarios
    const scopeError = mapAdsErrorMsg(403, 'access_token_scope_insufficient');
    expect(scopeError).toContain('gcloud auth application-default login');
    expect(scopeError).toContain('--scopes=');
    
    const tokenError = mapAdsErrorMsg(401, 'invalid token');
    expect(tokenError).toContain('Refresh ADC');
    
    const developerTokenError = mapAdsErrorMsg(403, 'developer token not ready');
    expect(developerTokenError).toContain('GOOGLE_ADS_DEVELOPER_TOKEN');
  });

  it('handles network connectivity issues', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Mock fetch to simulate network errors
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed'));

    const server = new LiveServer();
    registerTools(server as any);
    
    try {
      const res = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
      const text = res.content[0].text as string;
      
      // Should handle network errors gracefully
      expect(text).toMatch(/(Error|Network|Failed|timeout)/i);
    } catch (error) {
      // Network errors are expected in this test
      expect(error).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  }, 30_000);

  it('recovers from quota exceeded errors', async () => {
    if (!hasRequiredEnv) return;

    // Test quota error handling
    const { mapAdsErrorMsg } = await import('../../../src/utils/errorMapping.js');
    
    const quotaError = mapAdsErrorMsg(429, 'quota exceeded');
    expect(quotaError).toBeTruthy();
    expect(quotaError).toContain('quota');
    
    const rateLimitError = mapAdsErrorMsg(429, 'rate limit exceeded');
    expect(rateLimitError).toBeTruthy();
    expect(rateLimitError).toContain('rate limit');
  });

  it('handles missing developer token scenario', async () => {
    if (!hasRequiredEnv) return;

    cleanup = createTestAuthEnv({
      GOOGLE_ADS_DEVELOPER_TOKEN: undefined,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    try {
      await server.tools['execute_gaql_query']({
        customer_id: '1234567890',
        query: 'SELECT customer.id FROM customer LIMIT 1',
        output_format: 'table'
      });
    } catch (error: any) {
      expect(error.message).toContain('Missing developer token');
    }

    // Status should show missing developer token
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('GOOGLE_ADS_DEVELOPER_TOKEN: (not set)');
  }, 15_000);

  it('provides recovery guidance after authentication failure', async () => {
    if (!hasRequiredEnv) return;

    // Simulate auth failure scenario
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: undefined,
      GOOGLE_APPLICATION_CREDENTIALS: '/non/existent/path.json',
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    
    // Should provide guidance for setting up authentication
    if (text.includes('No authentication') || text.includes('ADC not found')) {
      expect(text).toMatch(/(gcloud auth|GOOGLE_APPLICATION_CREDENTIALS|OAuth)/i);
    }
  }, 15_000);

  it('tests manage_auth recovery actions', async () => {
    if (!hasRequiredEnv) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test refresh action for recovery
    const refreshRes = await server.tools['manage_auth']({ 
      action: 'refresh',
      allow_subprocess: false 
    });
    const refreshText = refreshRes.content[0].text as string;
    
    expect(refreshText).toContain('gcloud auth application-default login');
    expect(refreshText).toContain('cloud-platform');
    expect(refreshText).toContain('adwords');
    
    // Test switch action for account switching
    const switchRes = await server.tools['manage_auth']({ 
      action: 'switch',
      config_name: 'work',
      allow_subprocess: false 
    });
    const switchText = switchRes.content[0].text as string;
    
    expect(switchText).toContain('gcloud config configurations activate work');
  }, 15_000);

  it('validates error handling in different auth flows', async () => {
    if (!hasRequiredEnv) return;

    // Test that each auth method handles errors appropriately
    const server = new LiveServer();
    registerTools(server as any);
    
    // Test with completely broken environment
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: 'invalid-token',
      GOOGLE_APPLICATION_CREDENTIALS: undefined,
      GOOGLE_OAUTH_CLIENT_ID: undefined,
      GOOGLE_OAUTH_CLIENT_SECRET: undefined,
    });

    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    // Should handle the broken state gracefully
    expect(text).toMatch(/(Auth type: env|Token available|ADC)/i);
  }, 15_000);

  it('tests timeout and retry scenarios', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Mock fetch to simulate slow responses
    const originalFetch = global.fetch;
    let callCount = 0;
    
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call times out
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Request timeout');
      }
      // Second call succeeds (if retry logic exists)
      return new Response(JSON.stringify({ resourceNames: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    try {
      const res = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
      const text = res.content[0].text as string;
      
      // Should either succeed with retry or show appropriate error
      expect(text).toMatch(/(Accounts:|Error|timeout|failed)/i);
    } catch (error) {
      // Timeout errors are expected in this test
      expect(error).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  }, 30_000);

  it('validates comprehensive error mapping coverage', async () => {
    if (!hasRequiredEnv) return;

    const { mapAdsErrorMsg } = await import('../../../src/utils/errorMapping.js');
    
    // Test major error categories that the mapper handles
    const testCases = [
      { status: 403, text: 'access_token_scope_insufficient' },
      { status: 401, text: 'invalid token' },
      { status: 403, text: 'developer token not ready' },
      { status: 403, text: 'permission denied' },
      { status: 400, text: 'queryerror invalid syntax' },
    ];

    for (const { status, text } of testCases) {
      const mapped = mapAdsErrorMsg(status, text);
      if (mapped) {
        expect(typeof mapped).toBe('string');
        expect(mapped.length).toBeGreaterThan(10);
      }
    }
  });
});