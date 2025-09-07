import 'dotenv/config';
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

describe('live: execute_gaql_query (customer snapshot)', () => {
  it('SELECT customer.id,currency_code FROM customer LIMIT 1', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return; // skip if not configured
    const server = new LiveServer();
    registerTools(server as any);
    const cid = await pickAccountId(server);
    if (!cid) return; // nothing to test
    const query = 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Query Results:');
  }, 30_000);
});

