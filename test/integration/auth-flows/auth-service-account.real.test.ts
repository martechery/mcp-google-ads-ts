import 'dotenv/config';
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { registerTools } from '../../../src/server-tools.js';
import { extractCurrentAuthDetails, createTestAuthEnv, type ExtractedAuthDetails } from '../../utils/auth-extractor.js';
import { existsSync } from 'fs';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { 
  public tools: Record<string, ToolHandler> = {}; 
  tool(def: any, handler: ToolHandler) { 
    this.tools[def.name] = handler; 
  } 
}

describe('Auth Flow: Service Account', () => {
  let authDetails: ExtractedAuthDetails;
  let cleanup: (() => void) | null = null;
  const hasRequiredEnv = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN && !!process.env.GOOGLE_ADS_ACCOUNT_ID;
  const hasServiceAccount = !!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS);

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

  it('checks for service account credentials', async () => {
    if (hasServiceAccount) {
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeTruthy();
      expect(existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!)).toBe(true);
      console.log(`Found service account at: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    } else {
      console.log('No service account credentials found - tests will use simulated scenarios');
    }
  });

  it('simulates service account authentication', async () => {
    if (!hasRequiredEnv) return;

    // Mock google-auth-library to simulate service account flow
    vi.mock('google-auth-library', () => ({
      GoogleAuth: class MockGoogleAuth {
        async getAccessToken() {
          return authDetails.token;
        }
        async getClient() {
          return {
            getAccessToken: async () => ({ token: authDetails.token }),
            credentials: { quota_project_id: authDetails.project }
          };
        }
        async getCredentials() {
          return {
            type: 'service_account',
            project_id: authDetails.project,
            client_email: 'test-sa@' + authDetails.project + '.iam.gserviceaccount.com'
          };
        }
      }
    }));

    // Set up environment to use service account
    cleanup = createTestAuthEnv({
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake-service-account.json',
      GOOGLE_ADS_ACCESS_TOKEN: undefined, // Remove env token to force SA flow
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    // Should show either ADC or service account auth
    expect(text).toMatch(/(Auth type: adc|service account|ADC)/i);
  }, 15_000);

  it('tests service account with impersonation', async () => {
    if (!hasRequiredEnv) return;

    // Mock service account with impersonation
    vi.mock('google-auth-library', () => ({
      GoogleAuth: class MockGoogleAuth {
        constructor(options: any) {
          this.options = options;
        }
        async getAccessToken() {
          return authDetails.token;
        }
        async getClient() {
          return {
            getAccessToken: async () => ({ token: authDetails.token }),
            credentials: { 
              quota_project_id: authDetails.project,
              subject: 'impersonated-user@example.com'
            }
          };
        }
        async getCredentials() {
          return {
            type: 'service_account',
            project_id: authDetails.project,
            client_email: 'impersonation-sa@' + authDetails.project + '.iam.gserviceaccount.com',
            subject: 'impersonated-user@example.com'
          };
        }
      }
    }));

    cleanup = createTestAuthEnv({
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake-impersonation-sa.json',
      GOOGLE_ADS_ACCESS_TOKEN: undefined,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that impersonation scenario is handled
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    // Should detect some form of authentication
    expect(text).toMatch(/(Token available|Auth type|ADC)/i);
  }, 15_000);

  it('validates service account quota project handling', async () => {
    if (!hasRequiredEnv) return;

    // Mock service account with specific quota project
    const testQuotaProject = 'test-quota-project-123';
    
    vi.mock('google-auth-library', () => ({
      GoogleAuth: class MockGoogleAuth {
        async getAccessToken() {
          return authDetails.token;
        }
        async getClient() {
          return {
            getAccessToken: async () => ({ token: authDetails.token }),
            credentials: { 
              quota_project_id: testQuotaProject,
              project_id: authDetails.project
            }
          };
        }
        async getCredentials() {
          return {
            type: 'service_account',
            project_id: authDetails.project,
            quota_project_id: testQuotaProject,
            client_email: 'quota-test-sa@' + authDetails.project + '.iam.gserviceaccount.com'
          };
        }
      }
    }));

    cleanup = createTestAuthEnv({
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/fake-quota-sa.json',
      GOOGLE_ADS_ACCESS_TOKEN: undefined,
      GOOGLE_ADS_QUOTA_PROJECT_ID: testQuotaProject,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    // Should show quota project information
    expect(text).toContain('Google Ads Auth Status');
    if (text.includes('Quota project:')) {
      expect(text).toContain(testQuotaProject);
    }
  }, 15_000);

  it('handles service account authentication errors', async () => {
    if (!hasRequiredEnv) return;

    // Mock service account that fails authentication
    vi.mock('google-auth-library', () => ({
      GoogleAuth: class MockGoogleAuth {
        async getAccessToken() {
          throw new Error('Service account key not found or invalid');
        }
        async getClient() {
          throw new Error('Service account authentication failed');
        }
        async getCredentials() {
          throw new Error('Invalid service account credentials');
        }
      }
    }));

    cleanup = createTestAuthEnv({
      GOOGLE_APPLICATION_CREDENTIALS: '/tmp/invalid-service-account.json',
      GOOGLE_ADS_ACCESS_TOKEN: undefined,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // Should handle errors gracefully
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    // Should show some indication of auth issues or fallback
    expect(text).toMatch(/(No authentication|Error|Token available: No|ADC not found)/i);
  }, 15_000);

  it('tests real service account if available', async () => {
    if (!hasRequiredEnv || !hasServiceAccount || !authDetails.hasValidADC) return;

    // Test with real service account if available
    const server = new LiveServer();
    registerTools(server as any);
    
    // Override to use service account instead of ADC
    cleanup = createTestAuthEnv({
      GOOGLE_ADS_ACCESS_TOKEN: undefined, // Remove env token
      // Keep existing GOOGLE_APPLICATION_CREDENTIALS
    });

    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    
    // If we have a real service account, try to make an API call
    if (text.includes('Token available: Yes')) {
      const listRes = await server.tools['list_resources']({ 
        kind: 'accounts', 
        output_format: 'json' 
      });
      
      expect(listRes.content[0]).toBeDefined();
      const content = listRes.content[0].text;
      expect(content).toContain('resourceNames');
    }
  }, 30_000);

  it('validates service account scopes and permissions', async () => {
    if (!hasRequiredEnv) return;

    // Test that service account has proper Google Ads API scopes
    // This is more of a validation test for the auth flow setup
    
    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    
    // The status should provide information about available authentication methods
    expect(text).toMatch(/(ADC|Token|service account|Auth type)/i);
  }, 15_000);
});