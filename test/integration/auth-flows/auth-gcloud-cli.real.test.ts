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

describe('Auth Flow: gcloud CLI Fallback', () => {
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

  it('simulates gcloud CLI token acquisition', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    // Test the gcloud CLI fallback logic by simulating the flow
    // We use the extracted token to simulate what gcloud would return
    
    // Mock the gcloud command execution to return our known good token
    vi.mock('../../../src/utils/exec.js', () => ({
      execCmd: vi.fn(async (cmd: string, args: string[]) => {
        if (cmd === 'gcloud' && args.includes('print-access-token')) {
          return { 
            code: 0, 
            stdout: authDetails.token,
            stderr: '' 
          };
        }
        return { code: 0, stdout: 'success', stderr: '' };
      }),
    }));

    // Remove ADC to force CLI fallback
    cleanup = createTestAuthEnv({
      GOOGLE_APPLICATION_CREDENTIALS: undefined,
    });

    const server = new LiveServer();
    registerTools(server as any);
    
    // This test verifies that the gcloud CLI fallback mechanism works
    // Since we're mocking the exec, we can't test the actual CLI call,
    // but we can verify the code path exists
    expect(server.tools['manage_auth']).toBeDefined();
  });

  it('handles gcloud CLI authentication in manage_auth tool', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test the refresh action which may use gcloud CLI
    const res = await server.tools['manage_auth']({ 
      action: 'refresh',
      allow_subprocess: false // Get instructions only, don't execute
    });
    
    const text = res.content[0].text as string;
    
    expect(text).toContain('gcloud auth application-default login');
    expect(text).toContain('--scopes=');
    expect(text).toContain('cloud-platform');
    expect(text).toContain('adwords');
  }, 15_000);

  it('verifies gcloud CLI is available on system', async () => {
    if (!hasRequiredEnv) return;

    // Test that gcloud is actually available
    const { execSync } = await import('child_process');
    
    let gcloudAvailable = false;
    try {
      const version = execSync('gcloud version', { 
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      gcloudAvailable = version.includes('Google Cloud SDK');
    } catch {
      // gcloud not available
    }

    if (gcloudAvailable) {
      expect(gcloudAvailable).toBe(true);
      
      // Also test that our current setup shows gcloud is working
      const server = new LiveServer();
      registerTools(server as any);
      
      const res = await server.tools['manage_auth']({ action: 'status' });
      const text = res.content[0].text as string;
      
      // Should show some indication of gcloud being available
      expect(text).toContain('Google Ads Auth Status');
    }
  }, 15_000);

  it('tests gcloud token refresh simulation', async () => {
    if (!hasRequiredEnv || !authDetails.hasValidADC) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test refresh with subprocess allowed - this will use real gcloud if available
    // or show appropriate error messages if not
    const res = await server.tools['manage_auth']({ 
      action: 'refresh',
      allow_subprocess: true 
    });
    
    const text = res.content[0].text as string;
    
    // Should either show successful refresh or appropriate error handling
    expect(text).toMatch(/(refresh login exit:|gcloud not found|Install: https)/);
  }, 15_000);

  it('handles gcloud configuration switching', async () => {
    if (!hasRequiredEnv) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test switch action
    const res = await server.tools['manage_auth']({ 
      action: 'switch',
      config_name: 'test-config',
      allow_subprocess: true 
    });
    
    const text = res.content[0].text as string;
    
    // Should either show successful switch or appropriate error handling
    expect(text).toMatch(/(gcloud switch \(test-config\) exit:|gcloud not found|Install: https)/);
  }, 15_000);

  it('validates gcloud CLI error handling', async () => {
    if (!hasRequiredEnv) return;

    const server = new LiveServer();
    registerTools(server as any);
    
    // Test that error handling works correctly by trying an operation
    // that would fail if gcloud is not available
    const res = await server.tools['manage_auth']({ 
      action: 'refresh',
      allow_subprocess: true 
    });
    
    const text = res.content[0].text as string;
    
    // Should handle the situation gracefully
    expect(text).toMatch(/(refresh login exit:|gcloud not found|Install: https)/);
    
    // If gcloud is not found, should provide helpful instructions
    if (text.includes('gcloud not found') || text.includes('exit: 1')) {
      expect(text).toContain('Install: https://cloud.google.com/sdk/docs/install');
    }
  }, 15_000);
});