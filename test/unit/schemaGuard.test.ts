import { describe, it, expect } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;

class CaptureServer {
  public tools: Record<string, ToolHandler> = {};
  public defs: any[] = [];
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
    this.defs.push(def);
  }
}

describe('Tool schema guard', () => {
  it('root schema must not use oneOf/allOf/anyOf', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new CaptureServer();
    registerTools(server as any);
    for (const def of server.defs) {
      const schema = def?.input_schema || {};
      const keys = Object.keys(schema || {});
      expect(keys).not.toContain('oneOf');
      expect(keys).not.toContain('allOf');
      expect(keys).not.toContain('anyOf');
    }
  });
});
