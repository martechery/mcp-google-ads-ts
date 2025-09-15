import { describe, it, expect, beforeEach, afterEach } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('multi-tenant STRICT_IMMUTABLE_AUTH', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true' }; });
  afterEach(() => { process.env = OLD_ENV; });

  it('blocks re-setting credentials when STRICT_IMMUTABLE_AUTH=true', async () => {
    process.env.STRICT_IMMUTABLE_AUTH = 'true';
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const key = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const creds1 = { access_token: 't1', developer_token: 'd' };
    const creds2 = { access_token: 't2', developer_token: 'd' };
    const first = await server.tools['set_session_credentials']({ session_key: key, google_credentials: creds1 });
    expect(JSON.parse(String(first.content[0].text)).status).toBe('success');
    const second = await server.tools['set_session_credentials']({ session_key: key, google_credentials: creds2 });
    const obj = JSON.parse(String(second.content[0].text));
    expect(obj.error?.code).toBe('ERR_IMMUTABLE_AUTH');
  });

  it('allows overwrite when STRICT_IMMUTABLE_AUTH is not set', async () => {
    delete process.env.STRICT_IMMUTABLE_AUTH;
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const key = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const creds1 = { access_token: 'a', developer_token: 'd' };
    const creds2 = { access_token: 'b', developer_token: 'd' };
    await server.tools['set_session_credentials']({ session_key: key, google_credentials: creds1 });
    const res = await server.tools['set_session_credentials']({ session_key: key, google_credentials: creds2 });
    const obj = JSON.parse(String(res.content[0].text));
    expect(obj.status).toBe('success');
    // overwritten may be true
  });
});

