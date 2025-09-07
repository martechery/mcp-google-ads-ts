import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

function extractAccountIds(tableText: string): string[] {
  const ids = new Set<string>();
  for (const m of tableText.matchAll(/\b(\d{10})\b/g)) ids.add(m[1]);
  return Array.from(ids);
}

describe('live: get_performance', () => {
  it('account level last 7 days limit 5', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return; // skip if not configured
    const server = new LiveServer();
    registerTools(server as any);
    // Prefer explicit client ID if provided
    const preferred = process.env.GOOGLE_ADS_ACCOUNT_ID;
    const resList = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
    const textList = resList.content[0].text as string;
    const candidates = [preferred, ...extractAccountIds(textList)].filter(Boolean) as string[];

    let passed = false;
    for (const cid of candidates.slice(0, 10)) {
      const res = await server.tools['get_performance']({ customer_id: cid, level: 'account', days: 7, limit: 5, output_format: 'table' });
      const text = res.content[0].text as string;
      if (text.includes('Performance (account) for last 7 days:')) { passed = true; break; }
      // Skip manager accounts that error with REQUESTED_METRICS_FOR_MANAGER
      if (/REQUESTED_METRICS_FOR_MANAGER/i.test(text) || /manager account/i.test(text)) continue;
    }
    expect(passed).toBe(true);
  }, 30_000);
});
