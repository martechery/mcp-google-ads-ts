import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use hoisted mocks to avoid Vitest hoisting issues
const hoisted = vi.hoisted(() => ({
  executeGaqlMock: vi.fn(async () => ({ ok: true, status: 200, data: { results: [{ x: 1 }] } })),
}));

vi.mock('../../src/tools/gaql.js', () => ({ executeGaql: hoisted.executeGaqlMock }));

type ToolHandler = (input: any) => Promise<any> | any;
class FakeServer { public tools: Record<string, ToolHandler> = {}; tool(def: any, handler: ToolHandler) { this.tools[def.name] = handler; } }

describe('server-tools: per-call MCC override plumbing', () => {
  const OLD_ENV = process.env;

  beforeEach(async () => {
    process.env = { ...OLD_ENV, GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 'd' } as any;
    // Ensure mock has a known implementation between tests
    hoisted.executeGaqlMock.mockImplementation(async () => ({ ok: true, status: 200, data: { results: [{ x: 1 }] } }));
    hoisted.executeGaqlMock.mockClear();
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.resetAllMocks();
  });

  it('passes login_customer_id (and aliases) to executeGaql for execute_gaql_query', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);

    // Use alias `mcc`
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', mcc: '999-999-9999' });
    expect(hoisted.executeGaqlMock).toHaveBeenCalledTimes(1);
    expect(hoisted.executeGaqlMock.mock.calls[0][0].loginCustomerId).toBe('999-999-9999');

    // Use alias `managerAccountId`
    hoisted.executeGaqlMock.mockClear();
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', managerAccountId: '8888888888' });
    expect(hoisted.executeGaqlMock).toHaveBeenCalledTimes(1);
    expect(hoisted.executeGaqlMock.mock.calls[0][0].loginCustomerId).toBe('8888888888');

    // Use canonical `login_customer_id`
    hoisted.executeGaqlMock.mockClear();
    await server.tools['execute_gaql_query']({ customer_id: '1234567890', query: 'SELECT 1', login_customer_id: '777-777-7777' });
    expect(hoisted.executeGaqlMock).toHaveBeenCalledTimes(1);
    expect(hoisted.executeGaqlMock.mock.calls[0][0].loginCustomerId).toBe('777-777-7777');
  });

  it('passes login_customer_id to executeGaql for get_performance', async () => {
    const { registerTools } = await import('../../src/server-tools.js');
    const server = new FakeServer();
    registerTools(server as any);

    await server.tools['get_performance']({ level: 'account', customer_id: '1234567890', login_customer_id: '111-111-1111' });
    expect(hoisted.executeGaqlMock).toHaveBeenCalled();
    const args = hoisted.executeGaqlMock.mock.calls[0][0];
    expect(args.loginCustomerId).toBe('111-111-1111');
  });
});
