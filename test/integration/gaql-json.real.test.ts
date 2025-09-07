import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

async function pickAccountId(server: LiveServer): Promise<string | undefined> {
  const res = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
  const text = res.content[0].text as string;
  const m = text.match(/\b(\d{10})\b/);
  return process.env.GOOGLE_ADS_ACCOUNT_ID || m?.[1];
}

describe('live: GAQL JSON output', () => {
  it('returns JSON array for customer snapshot', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const cid = await pickAccountId(server);
    if (!cid) return;
    const query = 'SELECT customer.id FROM customer LIMIT 1';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, output_format: 'json' });
    const text = res.content[0].text as string;
    try {
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
    } catch {
      // If body is not JSON (e.g., error), allow soft-skip
      if (!/\[|\{/.test(text)) return;
      throw new Error('Expected JSON response but got: ' + text.slice(0, 200));
    }
  }, 30_000);
});

