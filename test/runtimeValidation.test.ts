import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

vi.mock('../src/tools/performance.js', () => ({
  buildPerformanceQuery: vi.fn((level: string, days: number, limit: number) => `D${days}-L${limit}`),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; }
}

describe('runtime bounds and clamping', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('execute_gaql_query clamps page_size to <= 10000 and >= 1', async () => {
    const { executeGaql } = await import('../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { x: 1 } ] } });
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', page_size: 9999999 });
    expect((executeGaql as any).mock.calls[0][0].pageSize).toBe(10000);
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', page_size: 0 });
    expect((executeGaql as any).mock.calls[1][0].pageSize).toBe(1);
  });

  it('get_performance clamps days to <= 365 and limit to <= 1000', async () => {
    const { executeGaql } = await import('../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { metrics: { clicks: 1 } } ] } });
    const { registerTools } = await import('../src/server-tools.js');
    const { buildPerformanceQuery } = await import('../src/tools/performance.js');
    const server = new FakeServer();
    registerTools(server as any);
    await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign', days: 9999, limit: 5000 });
    expect((buildPerformanceQuery as any).mock.calls[0][1]).toBe(365);
    expect((buildPerformanceQuery as any).mock.calls[0][2]).toBe(1000);
  });
});

