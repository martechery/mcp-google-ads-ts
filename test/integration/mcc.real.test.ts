import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

const hasMcc = !!process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID && !!process.env.GOOGLE_ADS_ACCOUNT_ID;

(hasMcc ? describe : describe.skip)('live: MCC header flow', () => {
  it('lists accounts under MCC', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Accounts:');
    expect(text).toContain(process.env.GOOGLE_ADS_ACCOUNT_ID as string);
  }, 30_000);

  it('runs customer snapshot via MCC login-customer header', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const cid = process.env.GOOGLE_ADS_ACCOUNT_ID as string;
    const query = 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Query Results:');
  }, 30_000);
});

