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

describe('live: GAQL campaigns snapshot', () => {
  it('SELECT campaign.id,name,status FROM campaign DURING LAST_7_DAYS LIMIT 5', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const cid = await pickAccountId(server);
    if (!cid) return;
    const query = 'SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE segments.date DURING LAST_7_DAYS ORDER BY campaign.id LIMIT 5';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text.includes('Query Results:') || text.toLowerCase().includes('no results')).toBe(true);
  }, 30_000);
});

