import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../src/tools/gaql.js', () => ({
  executeGaql: vi.fn(),
}));

vi.mock('../../src/tools/performance.js', () => ({
  buildPerformanceQuery: vi.fn(() => 'SELECT x'),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; }
}

describe('pagination pass-through', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
  });
  afterEach(() => { process.env = OLD_ENV; });

  it('execute_gaql_query forwards page_size/page_token and shows next token', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { x: 1 } ], nextPageToken: 'np1' } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', page_size: 100, page_token: 'tok1' });
    const text = res.content[0].text as string;
    expect((await import('../../src/tools/gaql.js')).executeGaql).toHaveBeenCalledWith({ customerId: '1234567890', query: 'SELECT 1', pageSize: 100, pageToken: 'tok1' });
    expect(text).toContain('Next Page Token: np1');
  });

  it('get_performance forwards page_size/page_token and shows next token', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any).mockResolvedValue({ ok: true, status: 200, data: { results: [ { metrics: { clicks: 1 } } ], nextPageToken: 'np2' } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign', page_size: 50, page_token: 'tok2' });
    expect((await import('../../src/tools/gaql.js')).executeGaql).toHaveBeenCalledWith({ customerId: '1234567890', query: 'SELECT x', pageSize: 50, pageToken: 'tok2' });
    const text = res.content[0].text as string;
    expect(text).toContain('Next Page Token: np2');
  });

  it('auto-paginates for execute_gaql_query and combines pages', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any)
      .mockResolvedValueOnce({ ok: true, status: 200, data: { results: [ { a: 1 } ], nextPageToken: 'n1' } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { results: [ { a: 2 } ] } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', auto_paginate: true, max_pages: 5 });
    const text = res.content[0].text as string;
    expect(text).toContain('Pages fetched: 2');
    expect(text).toContain('a');
  });

  it('auto-paginates for get_performance and combines pages', async () => {
    const { executeGaql } = await import('../../src/tools/gaql.js');
    (executeGaql as any)
      .mockResolvedValueOnce({ ok: true, status: 200, data: { results: [ { metrics: { clicks: 1 } } ], nextPageToken: 'n1' } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { results: [ { metrics: { clicks: 2 } } ] } });
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['get_performance']({ customer_id: '1234567890', level: 'campaign', auto_paginate: true });
    const text = res.content[0].text as string;
    expect(text).toContain('Pages fetched: 2');
  });
});
