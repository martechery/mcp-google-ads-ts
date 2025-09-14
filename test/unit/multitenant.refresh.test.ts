import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('multi-tenant refresh_access_token tool', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true' }; });
  afterEach(() => { process.env = OLD_ENV; vi.restoreAllMocks(); vi.resetModules(); });

  it('returns hint when OAuth client env not set', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    await server.tools['set_session_credentials']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', google_credentials: { access_token: 't', developer_token: 'd', refresh_token: 'r' } });
    const res = await server.tools['refresh_access_token']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
    const text = String(res.content[0].text);
    expect(text).toContain('OAuth client credentials not set');
  });

  it('refreshes when OAuth client env present (mocked)', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'secret';
    vi.doMock('google-auth-library', () => ({
      OAuth2Client: class {
        setCredentials() {}
        async refreshAccessToken() { return { credentials: { access_token: 'ya29.new', expiry_date: Date.now() + 3600_000 } }; }
      }
    }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    await server.tools['set_session_credentials']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', google_credentials: { access_token: 'ya29.old', developer_token: 'd', refresh_token: 'r' } });
    const res = await server.tools['refresh_access_token']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' });
    const obj = JSON.parse(String(res.content[0].text));
    expect(obj.status).toBe('refreshed');
    expect(obj.masked_token).toContain('****');
  });
});

