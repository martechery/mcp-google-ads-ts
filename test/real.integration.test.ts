import { describe, it, expect } from 'vitest';
import { listAccessibleCustomers } from '../src/tools/accounts.js';

const runReal = process.env.REAL_ADS_TEST === 'true' && !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

(runReal ? describe : describe.skip)('real integration (ADC + developer token)', () => {
  it('lists accounts using real API', async () => {
    const res = await listAccessibleCustomers();
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data?.resourceNames)).toBe(true);
  }, 30_000);
});

