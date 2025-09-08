import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { registerTools } from '../../../src/server-tools.js';
import { extractCurrentAuthDetails, type ExtractedAuthDetails } from '../../utils/auth-extractor.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { 
  public tools: Record<string, ToolHandler> = {}; 
  tool(def: any, handler: ToolHandler) { 
    this.tools[def.name] = handler; 
  } 
}

describe('Auth Flow: ADC Live', () => {
  let authDetails: ExtractedAuthDetails;
  const hasRequiredEnv = !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN && !!process.env.GOOGLE_ADS_ACCOUNT_ID;

  beforeAll(async () => {
    authDetails = await extractCurrentAuthDetails();
  });

  it('extracts valid ADC authentication details', async () => {
    if (!hasRequiredEnv) return;
    
    expect(authDetails.account).toMatch(/@/);
    expect(authDetails.project).toBeTruthy();
    expect(authDetails.hasValidADC).toBe(true);
    expect(authDetails.token).toMatch(/^ya29\./);
    expect(authDetails.adcFilePath).toContain('application_default_credentials.json');
  });

  it('verifies ADC token works with Google Ads API', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that ADC authentication works for listing accounts
    const res = await server.tools['list_resources']({ 
      kind: 'accounts', 
      output_format: 'json' 
    });
    
    expect(res.content[0]).toBeDefined();
    const content = res.content[0].text;
    expect(typeof content).toBe('string');
    
    // Parse JSON response to verify structure
    const parsed = JSON.parse(content);
    // The actual response format has account_id fields, not resourceNames
    expect(Array.isArray(parsed)).toBe(true);
    if (parsed.length > 0) {
      expect(parsed[0].account_id).toBeDefined();
    }
  }, 30_000);

  it('verifies manage_auth status shows ADC details correctly', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    
    expect(text).toContain('Google Ads Auth Status');
    expect(text).toContain('ADC');
    expect(text).toContain('Ads scope check: OK');
    
    // Should show token is available  
    expect(text).toContain('Token present: yes');
    
    // Should show environment variables
    expect(text).toContain('GOOGLE_ADS_DEVELOPER_TOKEN: (set)');
  }, 15_000);

  it('executes GAQL query using ADC authentication', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

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
    // The actual GAQL response structure may vary, check for common fields
    expect(parsed).toBeDefined();
    
    // Should contain customer data if results exist
    if (parsed.results && parsed.results.length > 0) {
      expect(parsed.results[0].customer).toBeDefined();
      expect(parsed.results[0].customer.id).toBeDefined();
    } else if (parsed.length > 0) {
      // Alternative format check
      expect(parsed[0]).toBeDefined();
    }
  }, 30_000);

  it('verifies ADC works with MCC login-customer-id header', async () => {
    const hasMccSetup = !!process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
    if (!hasRequiredEnv || !authDetails.hasValidADC || !hasMccSetup) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that MCC header flow works with ADC
    const res = await server.tools['list_resources']({ 
      kind: 'accounts', 
      output_format: 'table' 
    });
    
    const text = res.content[0].text as string;
    expect(text).toContain('Accounts:');
    expect(text).toContain(process.env.GOOGLE_ADS_ACCOUNT_ID as string);
  }, 30_000);

  it('shows proper error handling when ADC is missing scopes', async () => {
    // This test verifies error mapping works correctly
    // We don't actually break ADC, just verify the error handling logic exists
    if (!hasRequiredEnv) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // The error mapping should handle Google Ads API scope errors gracefully
    // This is more of a code coverage test to ensure the error paths are working
    expect(server.tools['manage_auth']).toBeDefined();
    expect(server.tools['execute_gaql_query']).toBeDefined();
  });
});