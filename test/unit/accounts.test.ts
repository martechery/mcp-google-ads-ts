import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listAccessibleCustomers } from '../../src/tools/accounts.js';

declare const global: any;

describe('listAccessibleCustomers', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    process.env.GOOGLE_ADS_ACCESS_TOKEN = 'tkn';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'dev';
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ resourceNames: ['customers/1234567890', 'customers/0000012345'] }),
      text: async () => '',
    }));
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.resetAllMocks();
  });

  it('calls listAccessibleCustomers and parses resourceNames', async () => {
    const res = await listAccessibleCustomers();
    expect(res.ok).toBe(true);
    expect(res.data?.resourceNames?.length).toBe(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('/v21/customers:listAccessibleCustomers');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer tkn');
  });
});
