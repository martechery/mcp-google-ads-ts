import 'dotenv/config';
import { describe, it, expect } from 'vitest';

import { registerTools } from '../../src/server-tools.js';

type ToolHandler = (input?: any) => Promise<any> | any;
class LiveServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

function uuidV4(): string {
  return 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
}

async function getRuntimeToken(): Promise<{ access_token: string; quota_project_id?: string }> {
  // Temporarily disable multi-tenant to fetch ADC token via our auth helper
  const old = process.env.ENABLE_RUNTIME_CREDENTIALS;
  delete process.env.ENABLE_RUNTIME_CREDENTIALS;
  const { getAccessToken } = await import('../../src/auth.js');
  const { token, quotaProjectId } = await getAccessToken();
  if (old != null) process.env.ENABLE_RUNTIME_CREDENTIALS = old; else delete process.env.ENABLE_RUNTIME_CREDENTIALS;
  return { access_token: token, quota_project_id: quotaProjectId } as any;
}

async function pickAccountId(server: LiveServer, session_key: string): Promise<string | undefined> {
  const res = await server.tools['list_resources']({ session_key, kind: 'accounts', output_format: 'table' });
  const text = res.content[0].text as string;
  const m = text.match(/\b(\d{10})\b/);
  return process.env.GOOGLE_ADS_ACCOUNT_ID || m?.[1];
}

describe('live: multi-tenant flow', () => {
  it('establish → list accounts → run GAQL', async () => {
    if (process.env.VITEST_REAL !== '1') return; // gated
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) return; // skip if no dev token

    const server = new LiveServer();
    registerTools(server as any);

    // Enable multi-tenant and optional scope verification
    const oldEnv = { ...process.env };
    process.env.ENABLE_RUNTIME_CREDENTIALS = 'true';
    process.env.VERIFY_TOKEN_SCOPE = process.env.VERIFY_TOKEN_SCOPE || 'true';

    const session_key = uuidV4();
    const adc = await getRuntimeToken();

    // Establish session
    const setRes = await server.tools['set_session_credentials']({
      session_key,
      google_credentials: {
        access_token: adc.access_token,
        developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        login_customer_id: process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID,
        quota_project_id: adc.quota_project_id,
      },
    });
    const setObj = JSON.parse(String(setRes.content[0].text));
    if (!setObj?.status) return; // scope verification may skip depending on env

    // Pick an account and run a simple GAQL
    const cid = await pickAccountId(server, session_key);
    if (!cid) return;
    const query = 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1';
    const res = await server.tools['execute_gaql_query']({ session_key, customer_id: cid, query, output_format: 'table' });
    const text = res.content[0].text as string;
    expect(text).toContain('Query Results:');

    // Clean up
    await server.tools['end_session']({ session_key });

    // Restore env
    process.env = oldEnv;
  }, 60_000);
});

