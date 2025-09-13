import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('gaql_help tool', () => {
  const OLD_ENV = process.env;
  beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); process.env = { ...OLD_ENV }; });
  afterEach(() => { process.env = OLD_ENV; });

  it('returns quick tips by default (topics and tips included)', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['gaql_help']({});
    const text = res.content[0].text as string;
    expect(text.toLowerCase()).toContain('quick tips');
    expect(text.toLowerCase()).toContain('available topics');
  });

  it('scores fetched chunks and returns condensed help (fetch mocked)', async () => {
    // Mock global fetch to return a tiny HTML doc with relevant content
    // @ts-expect-error: test overrides global.fetch
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => '<h1>Ordering</h1><p>Use ORDER BY field LIMIT 10</p><pre><code>SELECT campaign.id FROM campaign ORDER BY metrics.clicks DESC LIMIT 10</code></pre>' }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['gaql_help']({ question: 'How do I use ORDER BY and LIMIT?', topics: ['ordering'] });
    const text = res.content[0].text as string;
    expect(text.toLowerCase()).toContain('order by');
    expect(text.toLowerCase()).toContain('limit');
  });

  it('includes official docs and field references in default output', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['gaql_help']({});
    const text = res.content[0].text as string;
    expect(text).toContain('Google Ads Query Language (GAQL) Help');
    expect(text).toContain('Official Documentation');
    expect(text).toMatch(/overview: https:\/\/developers\.google\.com\/google-ads\/api\/docs\/query\/overview/);
    expect(text).toContain('Field Reference');
  });
});
