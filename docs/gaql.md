GAQL Cheat Sheet (Concise)

Overview
- Structure: `SELECT <fields> FROM <resource> [WHERE <predicates>] [ORDER BY <fields> [ASC|DESC]] [LIMIT n]`
- Resources (`FROM`): top-level entities like `campaign`, `ad_group`, `ad_group_ad`, `customer`, `search_term_view`, `product_group_view`, etc.
- Field types:
  - Resource/Attribute: identifiers and properties (e.g., `campaign.id`, `campaign.name`, `campaign.status`).
  - Metrics: numeric performance (e.g., `metrics.impressions`, `metrics.clicks`, `metrics.cost_micros`, `metrics.conversions`).
  - Segments: breakdown dimensions (e.g., `segments.date`, `segments.device`, `segments.ad_network_type`).
- Selectable/Filterable/Orderable: not every field is available on every `FROM`. Use the official docs or discovery tools to confirm.

Common Rules & Pitfalls
- Case sensitivity: field names are case-insensitive; string comparisons are case-sensitive.
- Date ranges: use `WHERE segments.date DURING <RANGE>` or `BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'`.
- Metrics + time series: include a time segment like `segments.date` when you want day-by-day.
- LIMIT/ORDER: `ORDER BY` must use a field in `SELECT`. Add `DESC`/`ASC` explicitly for clarity.
- Micros: costs are in micros; divide by 1e6 and pair with `customer.currency_code`.

Date Range Examples
```sql
-- Last 7 days
WHERE segments.date DURING LAST_7_DAYS

-- Custom dates (inclusive)
WHERE segments.date BETWEEN '2025-01-01' AND '2025-01-31'
```

Useful Predicates
```sql
WHERE campaign.status = 'ENABLED'
WHERE campaign.advertising_channel_type = 'SEARCH'
WHERE ad_group.status != 'REMOVED'
WHERE segments.device IN ('MOBILE', 'DESKTOP')
```

Examples

1) Daily campaign performance (last 7 days)
```sql
SELECT
  campaign.id,
  campaign.name,
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
ORDER BY segments.date DESC
LIMIT 1000
```

2) Enabled Search campaigns by CPA (last 30 days)
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.conversions,
  metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.advertising_channel_type = 'SEARCH'
  AND campaign.status = 'ENABLED'
ORDER BY metrics.cost_micros / NULLIF(metrics.conversions, 0)
LIMIT 200
```

3) Top ads by CTR (last 30 days)
```sql
SELECT
  ad_group.id,
  ad_group_ad.ad.id,
  ad_group_ad.status,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr
FROM ad_group_ad
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_ad.status = 'ENABLED'
ORDER BY metrics.ctr DESC
LIMIT 200
```

4) Search terms with clicks (last 30 days)
```sql
SELECT
  segments.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
  AND metrics.clicks > 0
ORDER BY metrics.clicks DESC
LIMIT 500
```

5) Product performance (Shopping) by item ID (last 14 days)
```sql
SELECT
  product_group_view.resource_name,
  segments.date,
  segments.product_item_id,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,
  metrics.cost_micros
FROM product_group_view
WHERE segments.date DURING LAST_14_DAYS
ORDER BY segments.date DESC
LIMIT 1000
```

6) Keywords with low QS (last 30 days)
```sql
SELECT
  ad_group.id,
  ad_group_criterion.criterion_id,
  ad_group_criterion.keyword.text,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions,
  metrics.clicks
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_criterion.status = 'ENABLED'
  AND ad_group_criterion.quality_info.quality_score <= 5
ORDER BY ad_group_criterion.quality_info.quality_score ASC
LIMIT 200
```

7) Geo performance (country) last 30 days
```sql
SELECT
  segments.geo_target_country,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions
FROM customer
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.conversions DESC
LIMIT 250
```

Discovery & Sources
- Not all fields are valid for a given `FROM` or predicate. Check the official Google Ads API GAQL docs for your API version, or use field discovery endpoints (GoogleAdsFieldService) to confirm `selectable`, `filterable`, and `orderable`.
- Pair these examples with the `list_resources` tool to choose the correct `FROM` resource for your question.

Notes
- These examples are generic; adapt filters and segments to your account structure and goals.
