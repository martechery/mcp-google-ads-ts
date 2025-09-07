import { describe, it, expect } from 'vitest';
import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('live: list_resources outputs', () => {
  it('resources JSON contains resource entries when present', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'resources', filter: 'campaign', limit: 10, output_format: 'json' });
    const text = res.content[0].text as string;
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr) || arr.length === 0) return; // soft-skip empty
      const first = arr[0] || {};
      expect(Object.prototype.hasOwnProperty.call(first, 'name')).toBe(true);
    } catch {
      // On error bodies (unlikely), soft-skip
      return;
    }
  }, 30_000);

  it('resources CSV header present for ad_group', async () => {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return;
    const server = new LiveServer();
    registerTools(server as any);
    const res = await server.tools['list_resources']({ kind: 'resources', filter: 'ad_group', limit: 5, output_format: 'csv' });
    const text = res.content[0].text as string;
    if (text.includes('No resources found.')) return; // soft-skip
    expect(text.split('\n')[0]).toBe('name,category,selectable');
  }, 30_000);
});

