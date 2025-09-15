import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('multi-tenant per-session rate limiting', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true', ENABLE_RATE_LIMITING: 'true', REQUESTS_PER_SECOND: '1', RATE_LIMIT_BURST: '1' };
  });
  afterEach(() => { vi.useRealTimers(); process.env = OLD_ENV; });

  it('limits consecutive requests and recovers after refill', async () => {
    // Mock executeGaql to avoid network
    vi.doMock('../../src/tools/gaql.js', () => ({
      executeGaql: vi.fn(async () => ({ ok: true, status: 200, data: { results: [] } })),
    }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const key = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    await server.tools['set_session_credentials']({ session_key: key, google_credentials: { access_token: 't', developer_token: 'd' } });

    const ok1 = await server.tools['execute_gaql_query']({ session_key: key, customer_id: '1234567890', query: 'SELECT 1' });
    const okText = String(ok1.content[0].text || '');
    expect(okText).not.toContain('ERR_RATE_LIMITED');

    const limited = await server.tools['execute_gaql_query']({ session_key: key, customer_id: '1234567890', query: 'SELECT 1' });
    const limText = String(limited.content[0].text || '');
    expect(limText).toContain('ERR_RATE_LIMITED');

    // advance time >1s to refill one token
    await vi.advanceTimersByTimeAsync(1200);
    const ok2 = await server.tools['execute_gaql_query']({ session_key: key, customer_id: '1234567890', query: 'SELECT 1' });
    const ok2Text = String(ok2.content[0].text || '');
    expect(ok2Text).not.toContain('ERR_RATE_LIMITED');
  });
});

