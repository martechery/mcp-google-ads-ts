import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tools/fields.js', () => ({
  searchGoogleAdsFields: vi.fn(async () => ({ ok: true, status: 200, data: { results: [
    { googleAdsField: { name: 'ad_group', category: 'RESOURCE', selectable: true } },
    { googleAdsField: { name: 'campaign', category: 'RESOURCE', selectable: true } },
  ] } }))
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
  }
}

describe('list_resources tool', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('prints a table of resources', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({});
    const text = res.content[0].text as string;
    expect(text).toContain('GAQL Resources:');
    expect(text).toContain('ad_group');
    expect(text).toContain('campaign');
  });

  it('adds hint on error mapping (scope insufficient)', async () => {
    vi.doMock('../../src/tools/fields.js', () => ({
      searchGoogleAdsFields: vi.fn(async () => ({ ok: false, status: 403, errorText: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' })),
    }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({});
    const text = res.content[0].text as string;
    expect(text).toContain('Hint:');
    expect(text.toLowerCase()).toContain('scope');
  });
});
