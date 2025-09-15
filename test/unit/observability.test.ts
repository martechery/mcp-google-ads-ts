import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

declare const process: any;

describe('observability: emits structured JSON to stderr', () => {
  const OLD_ENV = process.env;
  const writeOrig = process.stderr.write;
  const writes: string[] = [];
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: '' };
    writes.length = 0;
    process.stderr.write = (chunk: any) => { writes.push(String(chunk)); return true; };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    process.stderr.write = writeOrig;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('logs an event for execute_gaql_query', async () => {
    vi.doMock('../../src/tools/gaql.js', () => ({
      executeGaql: vi.fn(async () => ({ ok: true, status: 200, data: { results: [ { a: 1 } ] } })),
    }));
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1' });
    const line = writes.find((w) => w.includes('execute_gaql_query')) || '';
    expect(line).toContain('"tool":"execute_gaql_query"');
    expect(line).toContain('"response_time_ms"');
  });
});

