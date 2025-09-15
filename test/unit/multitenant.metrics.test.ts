import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

declare const process: any;

describe('multi-tenant metrics and lifecycle events', () => {
  const OLD_ENV = process.env;
  const writeOrig = process.stderr.write;
  const writes: string[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...OLD_ENV, ENABLE_RUNTIME_CREDENTIALS: 'true', EMIT_SESSION_METRICS: 'true', METRICS_INTERVAL: '50', CONNECTION_SWEEP_INTERVAL: '1', RUNTIME_CREDENTIAL_TTL: '1' };
    process.stderr.write = (chunk: any) => { writes.push(String(chunk)); return true; };
    writes.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env = OLD_ENV;
    process.stderr.write = writeOrig;
  });

  it('emits session_established, metrics_snapshot, and session_ended (ttl)', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);
    const key = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    await server.tools['set_session_credentials']({ session_key: key, google_credentials: { access_token: 't', developer_token: 'd' } });
    // established
    expect(writes.some((l) => l.includes('"tool":"session_established"'))).toBe(true);

    // metrics snapshot fires on sweeper tick; advance past 1s to trigger, and METRICS_INTERVAL is 50ms
    await vi.advanceTimersByTimeAsync(1200);
    expect(writes.some((l) => l.includes('"tool":"metrics_snapshot"'))).toBe(true);

    // let TTL pass and sweeper run
    await vi.advanceTimersByTimeAsync(1500);
    expect(writes.some((l) => l.includes('"tool":"session_ended"') && l.includes('"reason":"ttl"'))).toBe(true);
    expect(writes.some((l) => l.includes('"tool":"session_sweep"'))).toBe(true);
  });
});
