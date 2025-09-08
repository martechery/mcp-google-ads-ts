# GAQL Field Reference

Version-specific field reference and field discovery resources for Google Ads Query Language.

## Official Field References

### Current Supported Versions

**v21 (Current Default)**
- [v21 Field Reference](https://developers.google.com/google-ads/api/reference/rpc/v21/overview)
- [v21 Query Builder](https://developers.google.com/google-ads/api/fields/v21/overview_query_builder)

**v20 (Previous Version)**
- [v20 Field Reference](https://developers.google.com/google-ads/api/reference/rpc/v20/overview) 
- [v20 Query Builder](https://developers.google.com/google-ads/api/fields/v20/overview_query_builder)

## Field Types

### Resource Fields
Entity properties and attributes:
- `campaign.id`, `campaign.name`, `campaign.status`
- `ad_group.id`, `ad_group.name`, `ad_group.type`
- `ad_group_ad.ad.id`, `ad_group_ad.status`
- `customer.id`, `customer.currency_code`

### Metrics
Performance and statistical data:
- `metrics.clicks`, `metrics.impressions`, `metrics.ctr`
- `metrics.cost_micros`, `metrics.conversions`
- `metrics.average_cpc`, `metrics.average_cpm`
- `metrics.conversion_rate`, `metrics.cost_per_conversion`

### Segments
Breakdown dimensions:
- `segments.date`, `segments.week`, `segments.month`
- `segments.device`, `segments.ad_network_type`
- `segments.keyword.info.text`, `segments.keyword.info.match_type`

## Field Discovery

### Using list_resources Tool
```
"List all available resources and their fields"
"Show me fields available for the campaign resource"
"What metrics can I use with ad_group queries?"
```

### Field Compatibility Rules

1. **Selectable**: Field can be included in SELECT clause
2. **Filterable**: Field can be used in WHERE clause  
3. **Sortable**: Field can be used in ORDER BY clause
4. **Segmentable**: Field can be used for data breakdown

### Resource-Specific Fields

Each resource has different available fields:

**Campaign Resource**
- All campaign.* fields
- Associated metrics when time segment included
- Campaign-level segments (device, network, etc.)

**Ad Group Resource**  
- All ad_group.* fields
- Associated campaign.* fields (attributed)
- Ad group-level metrics and segments

**Keyword View Resource**
- All ad_group_criterion.* fields for keywords
- Associated campaign.* and ad_group.* fields
- Keyword-specific metrics and segments

## Version-Specific Considerations

### API Version Configuration
The MCP server uses the version set in `GOOGLE_ADS_API_VERSION`:
- Default: `v21`
- Supports: `21`, `v21`, `V21` (normalized to `v21`)

### Version Differences
- **v21**: Latest features, newest fields, most comprehensive
- **v20**: Stable version, some newer fields may be unavailable
- **Deprecated versions**: v19 and earlier (avoid in new projects)

## Common Field Combinations

### Campaign Performance
```sql
SELECT 
  campaign.id,
  campaign.name, 
  campaign.status,
  metrics.clicks,
  metrics.impressions,
  metrics.cost_micros
FROM campaign
```

### Device Breakdown
```sql  
SELECT
  campaign.name,
  segments.device,
  metrics.clicks,
  metrics.impressions
FROM campaign
```

### Time Series Data
```sql
SELECT
  campaign.name,
  segments.date,
  metrics.clicks,
  metrics.conversions
FROM campaign
```

### Geographic Performance
```sql
SELECT
  campaign.name,
  campaign_criterion.location.geo_target_constant,
  metrics.impressions,
  metrics.clicks  
FROM location_view
```

## Field Validation

### Before Building Queries
1. Check field exists in your API version
2. Verify field compatibility with chosen resource
3. Ensure required segments for metrics are included
4. Validate field is selectable/filterable as needed

### Common Issues
- **Field not selectable**: Cannot be used in SELECT
- **Field not available for resource**: Wrong FROM clause
- **Missing time segment**: Required for most metrics
- **Incompatible field combinations**: Some fields cannot be selected together

## Field Discovery Workflow

1. **Identify Use Case**: What data do you need?
2. **Choose Resource**: Which resource contains your primary entities?  
3. **Check Field Reference**: Verify fields exist and are compatible
4. **Build Query**: Start simple, add complexity gradually
5. **Test & Validate**: Run query and verify results

## Useful Field Patterns

### Currency Handling
```sql
SELECT 
  customer.currency_code,
  metrics.cost_micros,
  metrics.average_cpc
FROM campaign
```
Note: Costs are in micros (divide by 1,000,000 for actual currency)

### Quality Score Analysis
```sql
SELECT
  ad_group_criterion.keyword.text,
  ad_group_criterion.quality_info.quality_score,
  ad_group_criterion.quality_info.search_predicted_ctr,
  ad_group_criterion.quality_info.creative_quality_score
FROM keyword_view  
```

### Status and Approval Fields
```sql
SELECT
  campaign.status,
  ad_group.status, 
  ad_group_ad.status,
  ad_group_ad.policy_summary.approval_status
FROM ad_group_ad
```

## Official Documentation

[Google Ads API Field Reference](https://developers.google.com/google-ads/api/reference/rpc/v21/overview)
[Interactive Query Builder](https://developers.google.com/google-ads/api/fields/v21/overview_query_builder)