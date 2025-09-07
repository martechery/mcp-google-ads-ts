import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('live: list_resources(resources)', () => {
  it('filter=campaign shows campaign in GAQL Resources', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'resources', filter: 'campaign', limit: 10, output_format: 'table' });
    const text = res.content[0].text as string;
    if (text.includes('No resources found.')) return; // soft-skip
    expect(text).toContain('GAQL Resources:');
    expect(text.toLowerCase()).toContain('campaign');
  }, 30_000);
});
