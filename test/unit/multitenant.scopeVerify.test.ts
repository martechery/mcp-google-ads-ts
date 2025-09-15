import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

declare const global: any;

describe('multi-tenant scope verification on session establish', () => {
  const OLD_ENV = process.env;
  const realFetch = global.fetch;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true', VERIFY_TOKEN_SCOPE: 'true' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    global.fetch = realFetch;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('passes when listAccessibleCustomers returns ok', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ resourceNames: [] }) }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const creds = { access_token: 'ya29.t', developer_token: 'dev' };
    const res = await server.tools['set_session_credentials']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', google_credentials: creds });
    const obj = JSON.parse(String(res.content[0].text));
    expect(obj.status).toBe('success');
  });

  it('fails with ERR_INSUFFICIENT_SCOPE on 403', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 403, text: async () => 'forbidden' }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const creds = { access_token: 'ya29.t', developer_token: 'dev' };
    const res = await server.tools['set_session_credentials']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', google_credentials: creds });
    const obj = JSON.parse(String(res.content[0].text));
    expect(obj.error?.code).toBe('ERR_INSUFFICIENT_SCOPE');
  });
});

