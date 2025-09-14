import { describe, it, expect, beforeEach, afterEach } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
  }
}

describe('multi-tenant manage_auth gating', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('manage_auth returns disabled message in multi-tenant mode', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    expect(text).toContain('multi-tenant mode');
    expect(text).toContain('disabled');
  });
});

