import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/tools/accounts.js', () => ({
  listAccessibleCustomers: vi.fn().mockResolvedValue({ ok: true, status: 200, data: { resourceNames: ['customers/123'] } }),
}));

vi.mock('../src/utils/exec.js', () => ({
  execCmd: vi.fn(async () => ({ code: 0, stdout: 'ok', stderr: '' })),
}));

type ToolHandler = (input: any) => Promise<any> | any;

class FakeServer {
  public tools: Record<string, ToolHandler> = {};
  tool(def: any, handler: ToolHandler) {
    this.tools[def.name] = handler;
  }
}

describe('manage_auth tool', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('status prints scope check and token presence', async () => {
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'status' });
    const text = res.content[0].text as string;
    expect(text).toContain('Google Ads Auth Status');
    expect(text).toContain('Ads scope check: OK');
  });

  it('switch returns instructions when allow_subprocess=false', async () => {
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'switch', config_name: 'work', allow_subprocess: false });
    const text = res.content[0].text as string;
    expect(text).toContain('Planned action: switch gcloud configuration');
    expect(text).toContain('gcloud config configurations activate work');
  });

  it('switch executes when allow_subprocess=true', async () => {
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'switch', config_name: 'work', allow_subprocess: true });
    const text = res.content[0].text as string;
    expect(text).toContain('gcloud switch (work) exit: 0');
    expect(text).toContain('Next: refresh ADC credentials');
  });

  it('refresh returns instructions without subprocess', async () => {
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'refresh', allow_subprocess: false });
    const text = res.content[0].text as string;
    expect(text).toContain('Planned action: refresh ADC credentials');
    expect(text).toContain('gcloud auth application-default login');
  });

  it('refresh runs subprocess and verifies scope', async () => {
    const { registerTools } = await import('../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const res = await server.tools['manage_auth']({ action: 'refresh', allow_subprocess: true });
    const text = res.content[0].text as string;
    expect(text).toContain('refresh login exit: 0');
    expect(text).toContain('Ads scope check after refresh: OK');
  });
});
