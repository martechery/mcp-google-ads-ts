import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

vi.mock('../src/tools/performance.js', () => ({
  buildPerformanceQuery: vi.fn(() => 'SELECT x'),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; }
}

describe('currency helper in performance output', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('adds metrics.cost_units and includes currency code', async () => {
    const { executeGaql } = await import('../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { customer: { currency_code: 'USD' }, metrics: { cost_micros: 1234567, clicks: 2 } } ] } });
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign' });
    const text = res.content[0].text as string;
    expect(text).toContain('metrics.cost_units');
    expect(text).toContain('customer.currency_code');
  });
});

