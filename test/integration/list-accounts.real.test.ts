import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('live: list_resources(kind=accounts)', () => {
  it('lists accessible accounts table', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return; // skip if not configured
    const server = new LiveServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'accounts', output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Accounts:');
    // Expect at least one 10-digit id present
    expect(/\b\d{10}\b/.test(text)).toBe(true);
  }, 30_000);
});

