import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

vi.mock('../src/tools/fields.js', () => ({
  searchGoogleAdsFields: vi.fn(),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; }
}

describe('output formats', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('execute_gaql_query outputs JSON', async () => {
    const { executeGaql } = await import('../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { x: 1 } ] } });
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', output_format: 'json' });
    const text = res.content[0].text as string;
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].x).toBe(1);
  });

  it('list_resources outputs CSV', async () => {
    const { searchGoogleAdsFields } = await import('../src/tools/fields.js');
    (searchGoogleAdsFields as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { googleAdsField: { name: 'campaign', category: 'RESOURCE', selectable: true } } ] } });
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ output_format: 'csv' });
    const text = res.content[0].text as string;
    expect(text.split('\n')[0]).toBe('name,category,selectable');
    expect(text).toContain('campaign');
  });
});

