# GAQL Query Cookbook

Practical GAQL queries that replicate common Google Ads UI screens and demonstrate common patterns.

## UI Screen Replications

### Campaigns Overview
Replicate the default Campaigns screen:

```sql
SELECT 
  campaign.name,
  campaign_budget.amount_micros,
  campaign.status,
  campaign.optimization_score,
  campaign.advertising_channel_type,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  campaign.bidding_strategy_type
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
  AND campaign.status != 'REMOVED'
```

### Ad Groups Overview
Replicate the default Ad Groups screen:

```sql
SELECT 
  ad_group.name,
  campaign.name,
  ad_group.status,
  ad_group.type,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros
FROM ad_group
WHERE segments.date DURING LAST_7_DAYS
  AND ad_group.status != 'REMOVED'
```

### Ads Overview
Replicate the default Ads screen with ad components:

```sql
SELECT 
  ad_group_ad.ad.expanded_text_ad.headline_part1,
  ad_group_ad.ad.expanded_text_ad.headline_part2,
  ad_group_ad.ad.expanded_text_ad.headline_part3,
  ad_group_ad.ad.final_urls,
  ad_group_ad.ad.expanded_text_ad.description,
  ad_group_ad.ad.expanded_text_ad.description2,
  campaign.name,
  ad_group.name,
  ad_group_ad.policy_summary.approval_status,
  ad_group_ad.ad.type,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros
FROM ad_group_ad
WHERE segments.date DURING LAST_7_DAYS
  AND ad_group_ad.status != 'REMOVED'
```

### Search Keywords
Replicate the default Search Keywords screen:

```sql
SELECT 
  ad_group_criterion.keyword.text,
  campaign.name,
  ad_group.name,
  ad_group_criterion.system_serving_status,
  ad_group_criterion.keyword.match_type,
  ad_group_criterion.approval_status,
  ad_group_criterion.final_urls,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros
FROM keyword_view
WHERE segments.date DURING LAST_7_DAYS
  AND ad_group_criterion.status != 'REMOVED'
```

### Search Terms
Replicate the default Search Terms screen:

```sql
SELECT 
  search_term_view.search_term,
  segments.keyword.info.match_type,
  search_term_view.status,
  campaign.name,
  ad_group.name,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  campaign.advertising_channel_type
FROM search_term_view
WHERE segments.date DURING LAST_7_DAYS
```

## Demographics Queries

### Age Demographics
```sql
SELECT 
  ad_group_criterion.age_range.type,
  campaign.name,
  ad_group.name,
  ad_group_criterion.system_serving_status,
  ad_group_criterion.bid_modifier,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  campaign.advertising_channel_type
FROM age_range_view
WHERE segments.date DURING LAST_7_DAYS
```

### Gender Demographics
```sql
SELECT 
  ad_group_criterion.gender.type,
  campaign.name,
  ad_group.name,
  ad_group_criterion.system_serving_status,
  ad_group_criterion.bid_modifier,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  campaign.advertising_channel_type
FROM gender_view
WHERE segments.date DURING LAST_7_DAYS
```

## Geographic Queries

### Locations Performance
```sql
SELECT 
  campaign_criterion.location.geo_target_constant,
  campaign.name,
  campaign_criterion.bid_modifier,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros
FROM location_view
WHERE segments.date DURING LAST_7_DAYS
  AND campaign_criterion.status != 'REMOVED'
```

### Geo Target Lookup by Resource Name
```sql
SELECT 
  geo_target_constant.canonical_name,
  geo_target_constant.country_code,
  geo_target_constant.id,
  geo_target_constant.name,
  geo_target_constant.status,
  geo_target_constant.target_type
FROM geo_target_constant
WHERE geo_target_constant.resource_name = 'geoTargetConstants/1014044'
```

### Geo Target Lookup by Name
```sql
SELECT 
  geo_target_constant.canonical_name,
  geo_target_constant.country_code,
  geo_target_constant.id,
  geo_target_constant.name,
  geo_target_constant.status,
  geo_target_constant.target_type
FROM geo_target_constant
WHERE geo_target_constant.country_code = 'US'
  AND geo_target_constant.target_type = 'City'
  AND geo_target_constant.name = 'Mountain View'
  AND geo_target_constant.status = 'ENABLED'
```

## Audience Queries

### Audiences Overview
```sql
SELECT 
  ad_group_criterion.resource_name,
  ad_group_criterion.type,
  campaign.name,
  ad_group.name,
  ad_group_criterion.system_serving_status,
  ad_group_criterion.bid_modifier,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  campaign.advertising_channel_type
FROM ad_group_audience_view
WHERE segments.date DURING LAST_7_DAYS
```

## Common Query Patterns

### High-Level Performance Summary
```sql
SELECT 
  customer.currency_code,
  customer.time_zone,
  metrics.clicks,
  metrics.impressions,
  metrics.cost_micros,
  metrics.conversions
FROM customer
WHERE segments.date DURING LAST_30_DAYS
```

### Top Performing Campaigns
```sql
SELECT 
  campaign.name,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.cost_micros,
  metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status = 'ENABLED'
ORDER BY metrics.clicks DESC
LIMIT 20
```

### Device Performance Breakdown
```sql
SELECT 
  campaign.name,
  segments.device,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
  AND campaign.status = 'ENABLED'
ORDER BY campaign.name, segments.device
```

### Low Quality Score Keywords
```sql
SELECT 
  ad_group_criterion.keyword.text,
  campaign.name,
  ad_group.name,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_criterion.status = 'ENABLED'
  AND ad_group_criterion.quality_info.quality_score <= 5
ORDER BY ad_group_criterion.quality_info.quality_score ASC
LIMIT 100
```

## Tips for Query Construction

1. **Start Simple**: Begin with basic SELECT/FROM, then add complexity
2. **Check Field Compatibility**: Not all fields work with all resources
3. **Use Appropriate Resources**: Match the resource to your data needs
4. **Include Time Filters**: Always filter by date for performance metrics
5. **Filter Out Removed**: Usually exclude removed entities unless needed
6. **Order Results**: Use ORDER BY for consistent, meaningful result ordering

## Official Documentation

[Google Ads Query Cookbook](https://developers.google.com/google-ads/api/docs/query/cookbook)