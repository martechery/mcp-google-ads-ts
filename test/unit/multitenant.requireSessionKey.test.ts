import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock networked tools to avoid fetch
vi.mock('../../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(async () => ({ ok: true, status: 200, data: { results: [] } })),
}));
vi.mock('../../src/tools/accounts.js', () => ({
  listAccessibleCustomers: vi.fn(async () => ({ ok: true, status: 200, data: { resourceNames: [] } })),
}));
vi.mock('../../src/tools/fields.js', () => ({
  searchGoogleAdsFields: vi.fn(async () => ({ ok: true, status: 200, data: { results: [] } })),
}));

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('multi-tenant requires session_key on tools', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true' }; });
  afterEach(() => { process.env = OLD_ENV; });

  it('execute_gaql_query errors without session_key', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1' });
    const text = String(res.content[0].text);
    expect(text.toLowerCase()).toContain('session_key');
    expect(text.toLowerCase()).toContain('required');
  });

  it('list_resources errors without session_key', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'resources' });
    const text = String(res.content[0].text);
    expect(text.toLowerCase()).toContain('session_key');
    expect(text.toLowerCase()).toContain('required');
  });

  it('get_performance errors without session_key', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign' });
    const text = String(res.content[0].text);
    expect(text.toLowerCase()).toContain('session_key');
    expect(text.toLowerCase()).toContain('required');
  });
});

