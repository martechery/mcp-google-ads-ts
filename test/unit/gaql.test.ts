import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeGaql } from '../../src/tools/gaql.js';

declare const global: any;

describe('executeGaql', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    process.env.GOOGLE_ADS_ACCESS_TOKEN = 'test-token';
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'dev-token';
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ results: [{ campaign: { id: '1', name: 'C1' } }] }),
      text: async () => '',
    }));
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.resetAllMocks();
  });

  it('POSTs to Google Ads with headers and query body', async () => {
    const res = await executeGaql({ customerId: '1234567890', query: 'SELECT campaign.id FROM campaign LIMIT 1' });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(res.data?.results?.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toContain('/v19/customers/1234567890/googleAds:search');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(init.headers['developer-token']).toBe('dev-token');
    expect(JSON.parse(init.body).query).toContain('SELECT');
  });
});
