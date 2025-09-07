import { describe, it, expect } from 'vitest';
import { buildPerformanceQuery } from '../../src/tools/performance.js';

describe('buildPerformanceQuery', () => {
  it('includes fields for account', () => {
    const q = buildPerformanceQuery('account', 30, 50);
    expect(q).toContain('FROM customer');
    expect(q).toContain('customer.descriptive_name');
    expect(q).toContain('customer.currency_code');
    expect(q).toContain('metrics.cost_micros');
  });

  it('does not apply campaignNameContains at account level', () => {
    const q = buildPerformanceQuery('account', 30, 50, { campaignNameContains: 'Brand' });
    expect(q).not.toContain('campaign.name');
  });
  it('includes currency and metrics for campaign', () => {
    const q = buildPerformanceQuery('campaign', 7, 10);
    expect(q).toContain('FROM campaign');
    expect(q).toContain('customer.currency_code');
    expect(q).toContain('metrics.cost_micros');
    expect(q).toContain('LAST_7_DAYS');
    expect(q).toContain('LIMIT 10');
  });

  it('includes fields for ad_group', () => {
    const q = buildPerformanceQuery('ad_group');
    expect(q).toContain('FROM ad_group');
    expect(q).toContain('ad_group.status');
    expect(q).toContain('campaign.name');
  });

  it('includes fields for ad', () => {
    const q = buildPerformanceQuery('ad');
    expect(q).toContain('FROM ad_group_ad');
    expect(q).toContain('ad_group_ad.ad.id');
    expect(q).toContain('ad_group.name');
  });
});
