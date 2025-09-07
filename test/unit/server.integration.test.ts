import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

vi.mock('../../src/tools/accounts.js', () => ({
  listAccessibleCustomers: vi.fn(),
}));

vi.mock('../../src/tools/performance.js', () => ({
  buildPerformanceQuery: vi.fn(),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
  }
}

describe('server tools integration', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('execute_gaql_query formats rows', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { campaign: { id: '1', name: 'C' }, metrics: { clicks: 10 } } ] } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1' });
    const text = res.content[0].text as string;
    expect(text).toContain('Query Results:');
    expect(text).toContain('campaign.id');
    expect(text).toContain('metrics.clicks');
    expect(text).toContain('C');
  });

  it('list_resources(kind=accounts) prints IDs', async () => {
    const { listAccessibleCustomers } = await import('../../src/tools/accounts.js');
    (listAccessibleCustomers as any).mockResolvedValue({ ok: true, status: 200, data: { resourceNames: ['customers/1234567890', 'customers/0000012345'] } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'accounts' });
    const text = res.content[0].text as string;
    expect(text).toContain('Accounts:');
    expect(text).toContain('1234567890');
    expect(text).toContain('0000012345');
  });

  it('get_performance passes filters and formats', async () => {
    const { buildPerformanceQuery } = await import('../../src/tools/performance.js');
    (buildPerformanceQuery as any).mockReturnValue('SELECT x');
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { campaign: { name: 'C' }, customer: { currencyCode: 'USD' }, metrics: { costMicros: 1000000 } } ] } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const filters = { status: 'ENABLED', nameContains: 'Brand', minClicks: 10 };
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign', days: 7, limit: 5, filters });
    expect((await import('../../src/tools/performance.js')).buildPerformanceQuery).toHaveBeenCalledWith('campaign', 7, 5, filters);
    const text = res.content[0].text as string;
    expect(text).toContain('Performance (campaign) for last 7 days:');
    expect(text).toContain('customer.currencyCode');
  });
});
