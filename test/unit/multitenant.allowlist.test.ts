import { describe, it, expect, beforeEach, afterEach } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('multi-tenant allowlist enforcement', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true', ALLOWED_CUSTOMER_IDS: '1234567890' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('blocks execute_gaql_query for non-allowed customer', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    // Create session
    await server.tools['set_session_credentials']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', google_credentials: { access_token: 't', developer_token: 'd' } });
    const res = await server.tools['execute_gaql_query']({ session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', customer_id: '2222222222', query: 'SELECT 1' });
    const text = String(res.content[0].text);
    expect(text).toContain('not in allowlist');
  });
});

