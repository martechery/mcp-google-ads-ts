import { describe, it, expect, beforeEach, afterEach } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
  }
}

const sessionKey = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('multi-tenant session tools', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true', RUNTIME_CREDENTIAL_TTL: '3600' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('set_session_credentials, get_credential_status, end_session flow', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);

    const creds = {
      access_token: 'ya29.a1b2c3d4',
      developer_token: 'dev-123',
      login_customer_id: '1234567890',
      quota_project_id: 'proj-1',
    };

    // Establish session
    const setRes = await server.tools['set_session_credentials']({ session_key: sessionKey, google_credentials: creds });
    const setText = String(setRes.content[0].text);
    const setObj = JSON.parse(setText);
    expect(setObj.status).toBe('success');
    expect(setObj.session_key).toBe(sessionKey);
    expect(setObj.expires_in).toBeGreaterThan(0);

    // Status
    const stRes = await server.tools['get_credential_status']({ session_key: sessionKey });
    const stObj = JSON.parse(String(stRes.content[0].text));
    expect(stObj.has_credentials).toBe(true);
    expect(stObj.has_refresh_token).toBe(false);
    expect(String(stObj.masked_token)).toContain('****');

    // End
    const endRes = await server.tools['end_session']({ session_key: sessionKey });
    const endObj = JSON.parse(String(endRes.content[0].text));
    expect(endObj.status).toBe('session_ended');
  });
});

