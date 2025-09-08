# GAQL Overview

Google Ads Query Language (GAQL) is a SQL-like language for retrieving Google Ads data through the Google Ads API.

## Key Concepts

**Resources**: Top-level entities in Google Ads (campaign, ad_group, ad_group_ad, customer, etc.)
**Fields**: Properties of resources, divided into:
- **Attributes**: Descriptive properties (campaign.name, ad_group.status)
- **Metrics**: Performance data (metrics.clicks, metrics.impressions)  
- **Segments**: Breakdown dimensions (segments.date, segments.device)

## Basic Structure

```sql
SELECT <fields> 
FROM <resource> 
[WHERE <conditions>] 
[ORDER BY <field> [ASC|DESC]] 
[LIMIT <number>]
```

## Key Rules

1. **Case Sensitivity**: Field names are case-insensitive, string values are case-sensitive
2. **Field Compatibility**: Not all fields work with all resources - check field compatibility
3. **Performance Data**: Include time segments (like segments.date) when querying metrics
4. **Resource Selection**: Use appropriate FROM resource for your data needs

## Common Patterns

- Campaign performance: `FROM campaign` with metrics and segments.date
- Ad performance: `FROM ad_group_ad` with ad-specific metrics  
- Search terms: `FROM search_term_view` for query-level data
- Keywords: `FROM keyword_view` for keyword performance

## Next Steps

- Check field compatibility using the Google Ads API field reference
- Use the list_resources tool to discover available resources
- Start with simple queries and add complexity gradually

## Official Documentation

[Google Ads Query Language Overview](https://developers.google.com/google-ads/api/docs/query/overview)