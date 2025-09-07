import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tools/accounts.js', () => ({
  listAccessibleCustomers: vi.fn(async () => ({ ok: true, status: 200, data: { resourceNames: ['customers/1234567890','customers/0000012345'] } }))
}));

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('optional customer_id behavior', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' } as any;
    delete process.env.GOOGLE_ADS_ACCOUNT_ID;
    delete process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('execute_gaql_query lists accounts when customer_id missing', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ query: 'SELECT 1' });
    const text = res.content[0].text as string;
    expect(text).toContain('No customer_id provided');
    expect(text).toContain('account_id');
    expect(text).toContain('1234567890');
  });

  it('get_performance lists accounts when customer_id missing', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ level: 'campaign' });
    const text = res.content[0].text as string;
    expect(text).toContain('No customer_id provided');
    expect(text).toContain('account_id');
    expect(text).toContain('1234567890');
  });
});
