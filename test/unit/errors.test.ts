import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; }
}

describe('error mapping', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('adds GAQL syntax hint for 400', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: false, status: 400, errorText: 'QueryError: invalid query syntax' });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'bad' });
    const text = res.content[0].text as string;
    expect(text).toContain('Hint:');
    expect(text.toLowerCase()).toContain('gaql syntax');
  });

  it('adds scope hint for 403 ACCESS_TOKEN_SCOPE_INSUFFICIENT', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: false, status: 403, errorText: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign' });
    const text = res.content[0].text as string;
    expect(text).toContain('Hint:');
    expect(text.toLowerCase()).toContain('scope');
  });

  it('adds token hint for 401', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: false, status: 401, errorText: 'invalid token' });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign' });
    const text = res.content[0].text as string;
    expect(text).toContain('Hint:');
    expect(text.toLowerCase()).toContain('expired');
  });
});
