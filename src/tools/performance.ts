export type PerformanceLevel = 'campaign' | 'ad_group' | 'ad';

export type PerformanceFilters = {
  status?: string;
  nameContains?: string;
  campaignNameContains?: string;
  minClicks?: number;
  minImpressions?: number;
};

export function buildPerformanceQuery(
  level: PerformanceLevel,
  days = 30,
  limit = 50,
  filters: PerformanceFilters = {}
): string {
  const baseMetrics = `
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    metrics.average_cpc,
    customer.currency_code
  `;

  let fields = '';
  let from = '';
  let statusField = '';
  let nameField = '';
  const campaignNameField = 'campaign.name';
  switch (level) {
    case 'campaign':
      fields = `
        campaign.id,
        campaign.name,
        campaign.status,
        ${baseMetrics}
      `;
      from = 'campaign';
      statusField = 'campaign.status';
      nameField = 'campaign.name';
      break;
    case 'ad_group':
      fields = `
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ${baseMetrics}
      `;
      from = 'ad_group';
      statusField = 'ad_group.status';
      nameField = 'ad_group.name';
      break;
    case 'ad':
      fields = `
        campaign.name,
        ad_group.name,
        ad_group_ad.ad.id,
        ad_group_ad.status,
        ${baseMetrics}
      `;
      from = 'ad_group_ad';
      statusField = 'ad_group_ad.status';
      nameField = 'ad_group.name';
      break;
    default:
      throw new Error('Invalid level. Use campaign | ad_group | ad');
  }

  const whereClauses: string[] = [`
    SELECT
      ${fields}
    FROM ${from}
    WHERE segments.date DURING LAST_${days}_DAYS`];

  // Apply filters
  const esc = (v: string) => v.replace(/'/g, "''");
  if (filters.status) whereClauses.push(`AND ${statusField} = '${esc(filters.status)}'`);
  if (filters.nameContains) whereClauses.push(`AND ${nameField} LIKE '%${esc(filters.nameContains)}%'`);
  if (filters.campaignNameContains) whereClauses.push(`AND ${campaignNameField} LIKE '%${esc(filters.campaignNameContains)}%'`);
  if (typeof filters.minClicks === 'number') whereClauses.push(`AND metrics.clicks >= ${Math.max(0, Math.floor(filters.minClicks))}`);
  if (typeof filters.minImpressions === 'number') whereClauses.push(`AND metrics.impressions >= ${Math.max(0, Math.floor(filters.minImpressions))}`);

  const query = `
    ${whereClauses.join('\n    ')}
    ORDER BY metrics.cost_micros DESC
    LIMIT ${limit}
  `;
  return query;
}
