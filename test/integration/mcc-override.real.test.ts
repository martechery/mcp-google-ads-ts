import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

const hasMcc = !!process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID && !!process.env.GOOGLE_ADS_ACCOUNT_ID;

// Only run if we have live creds + MCC context
(hasMcc ? describe : describe.skip)('live: per-call MCC override', () => {
  it('execute_gaql_query works with per-call login_customer_id when env unset', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const mccId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID as string;
    const childId = process.env.GOOGLE_ADS_ACCOUNT_ID as string;
    const original = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
    delete process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
    try {
      const server = new LiveServer();
      registerTools(server as any);
      const query = 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1';
      const res = await server.tools['execute_gaql_query']({ customer_id: childId, login_customer_id: mccId, query, output_format: 'table' });
      const text = res.content[0].text as string;
      expect(text).toContain('Query Results:');
    } finally {
      if (original) process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID = original;
    }
  }, 30_000);

  it('get_performance works with per-call login_customer_id when env unset', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const mccId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID as string;
    const childId = process.env.GOOGLE_ADS_ACCOUNT_ID as string;
    const original = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
    delete process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
    try {
      const server = new LiveServer();
      registerTools(server as any);
      const res = await server.tools['get_performance']({ level: 'account', customer_id: childId, login_customer_id: mccId, days: 7, output_format: 'table' });
      const text = res.content[0].text as string;
      // Either a table or a friendly no-results message is acceptable
      expect(text).toMatch(/Performance \(account\).*|No results found/i);
    } finally {
      if (original) process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID = original;
    }
  }, 30_000);
});

