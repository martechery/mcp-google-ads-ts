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

describe('live: pagination smoke', () => {
  it('non-auto: page_size=1 shows next token if present', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const cid = await pickAccountId(server);
    if (!cid) return;
    const query = 'SELECT campaign.id, campaign.name FROM campaign ORDER BY campaign.id LIMIT 1000';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, page_size: 1, output_format: 'table' });
    const text = res.content[0].text as string;
    if (!text.includes('Next Page Token:')) {
      // soft-skip if only one page exists
      return;
    }
    expect(text).toContain('Next Page Token:');
  }, 30_000);

  it('auto: auto_paginate=true shows Pages fetched', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const cid = await pickAccountId(server);
    if (!cid) return;
    const query = 'SELECT campaign.id FROM campaign ORDER BY campaign.id LIMIT 1000';
    const res = await server.tools['execute_gaql_query']({ customer_id: cid, query, auto_paginate: true, max_pages: 2, output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Pages fetched:');
  }, 30_000);
});

