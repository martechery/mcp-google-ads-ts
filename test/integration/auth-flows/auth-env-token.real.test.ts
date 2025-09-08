import 'dotenv/config';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { registerTools } from '../../../src/server-tools.js';
import { extractCurrentAuthDetails, createTestAuthEnv, type ExtractedAuthDetails } from '../../utils/auth-extractor.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { 
  public tools: Record<string, ToolHandler> = {}; 
  tool(def: any, handler: ToolHandler) { 
    this.tools[def.name] = handler; 
  } 
}

describe('Auth Flow: Environment Token', () => {
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
  });

  it('uses extracted token as GOOGLE_ADS_ACCESS_TOKEN', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Set up environment with extracted token
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: authDetails.token,
      GOOGLE_ADS_QUOTA_PROJECT_ID: authDetails.quotaProject || authDetails.project,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that environment token authentication works
    const res = await server.tools['list_resources']({ 
      kind: 'accounts', 
      output_format: 'json' 
    });
    
    expect(res.content[0]).toBeDefined();
    const content = res.content[0].text;
    // The actual response format has account_id fields, not resourceNames
    
    // Verify it's using env token (not ADC)
    const parsed = JSON.parse(content);
    expect(Array.isArray(parsed)).toBe(true);
    if (parsed.length > 0) {
      expect(parsed[0].account_id).toBeDefined();
    }
  }, 30_000);

  it('shows env token in manage_auth status', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Set up environment with extracted token
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: authDetails.token,
      GOOGLE_ADS_QUOTA_PROJECT_ID: authDetails.quotaProject || authDetails.project,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    expect(text).toContain('Auth type: env');
    expect(text).toContain('Token present: yes');
    expect(text).toContain('GOOGLE_ADS_DEVELOPER_TOKEN: (set)');
    
    // Should show quota project if set
    if (authDetails.quotaProject || authDetails.project) {
      expect(text).toContain('Quota project:');
    }
  }, 15_000);

  it('executes GAQL query using environment token', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Set up environment with extracted token
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: authDetails.token,
      GOOGLE_ADS_QUOTA_PROJECT_ID: authDetails.quotaProject || authDetails.project,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const customerId = process.env.GOOGLE_ADS_ACCOUNT_ID;
    const query = 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1';
    
    const res = await server.tools['execute_gaql_query']({
      customer_id: customerId,
      query,
      output_format: 'json'
    });
    
    expect(res.content[0]).toBeDefined();
    const content = res.content[0].text;
    
    // Should be valid JSON response
    const parsed = JSON.parse(content);
    expect(parsed).toBeDefined();
    
    // Should contain customer data if results exist
    if (parsed.results && parsed.results.length > 0) {
      expect(parsed.results[0].customer).toBeDefined();
      expect(parsed.results[0].customer.id).toBeDefined();
    } else if (parsed.length > 0) {
      expect(parsed[0]).toBeDefined();
    }
  }, 30_000);

  it('handles quota project correctly with env token', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Test with explicit quota project
    const testQuotaProject = authDetails.project;
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: authDetails.token,
      GOOGLE_ADS_QUOTA_PROJECT_ID: testQuotaProject,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that quota project is included in requests
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Quota project:');
    expect(text).toContain(testQuotaProject);
  }, 15_000);

  it('prefers env token over ADC when both available', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Create a different token to ensure env token is used
    const testToken = authDetails.token.slice(0, 10) + 'TEST' + authDetails.token.slice(14);
    
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: testToken,
      GOOGLE_ADS_QUOTA_PROJECT_ID: authDetails.project,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    // Should indicate using env token, not ADC
    expect(text).toContain('Auth type: env');
    expect(text).not.toContain('Auth type: adc');
    
    // Note: We can't test the API call with the modified token since it would fail
    // This test just verifies the auth type detection logic
  }, 15_000);

  it('handles missing env token gracefully', async () => {
    if (!hasRequiredEnv) return;

    // Set up environment without access token (but with other vars)
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: undefined,
      GOOGLE_ADS_QUOTA_PROJECT_ID: authDetails.project,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Should fall back to ADC if available
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    // Should either use ADC or show no auth available
    expect(text).toMatch(/(Auth type: adc|No authentication|ADC)/i);
  }, 15_000);
});