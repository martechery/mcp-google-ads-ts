# GAQL Query Structure

Google Ads Query Language queries are built from multiple clauses that work together to fetch specific data.

## Query Components

A GAQL query consists of these clauses (in order):

1. **SELECT** (required) - Fields to fetch
2. **FROM** (required) - Main resource  
3. **WHERE** (optional) - Filtering conditions
4. **ORDER BY** (optional) - Result ordering
5. **LIMIT** (optional) - Result count restriction
6. **PARAMETERS** (optional) - Meta parameters

## SELECT Clause

Specifies fields to return in the response. Takes a comma-separated list of:
- **Resource fields**: Properties of entities (`campaign.id`, `campaign.name`)
- **Segment fields**: Breakdown dimensions (`segments.device`, `segments.date`)
- **Metrics**: Performance data (`metrics.impressions`, `metrics.clicks`)

```sql
SELECT 
  campaign.id,
  campaign.name,
  segments.device,
  segments.date,
  metrics.impressions,
  metrics.clicks
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

### SELECT Restrictions
- Non-selectable fields (marked as `Selectable: false`)
- Repeated fields (marked as `isRepeated: true`)
- Incompatible field combinations
- Fields not available for the FROM resource

## FROM Clause

Specifies the main resource for the query. Only one resource allowed per query.

```sql
SELECT ad_group.id FROM ad_group
```

### Attributed Resources
Some resources have implicit joins with attributed resources:

```sql
-- Can select campaign.id even though FROM is ad_group
SELECT campaign.id, ad_group.id FROM ad_group
```

### Resource Names
The `resource_name` field is always returned for the main resource and any selected attributed resources.

## WHERE Clause

Filters results using conditions. Multiple conditions joined with `AND`.

Pattern: `field_name Operator value`

```sql
SELECT campaign.name, metrics.clicks
FROM campaign 
WHERE metrics.impressions > 0
  AND segments.device = 'MOBILE'
  AND segments.date DURING LAST_30_DAYS
```

### Core Date Segments Rule
When selecting core date segments (`segments.date`, `segments.week`, `segments.month`, `segments.quarter`, `segments.year`), you **must** include at least one in the WHERE clause with a finite date range.

```sql
-- REQUIRED: segments.date in WHERE when selected
SELECT campaign.name, segments.date, metrics.clicks
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

### Segment Selection Rule
Segments in WHERE must also be in SELECT (except core date segments).

## ORDER BY Clause

Sorts results by specified fields. Default is ascending (`ASC`).

```sql
-- Single field ordering
SELECT campaign.name, metrics.clicks
FROM campaign
ORDER BY metrics.clicks DESC

-- Multiple field ordering
SELECT campaign.name, ad_group.name, metrics.impressions
FROM ad_group
ORDER BY campaign.name ASC, metrics.impressions DESC
```

## LIMIT Clause

Restricts the number of results returned.

```sql
SELECT campaign.name, metrics.impressions
FROM campaign
ORDER BY metrics.impressions DESC
LIMIT 50
```

## PARAMETERS Clause

Sets meta parameters for the request.

### include_drafts
Include draft entities in results (default: false).

```sql
SELECT campaign.name
FROM campaign
PARAMETERS include_drafts=true
```

### omit_unselected_resource_names
Omit resource_name fields unless explicitly selected (default: false).

```sql
SELECT campaign.name, customer.id
FROM campaign
PARAMETERS omit_unselected_resource_names=true
```

## Advanced Patterns

### Metrics-Only Queries
```sql
SELECT metrics.impressions, metrics.clicks, metrics.cost_micros
FROM campaign
```

### Segments-Only Queries  
```sql
SELECT segments.device FROM campaign
```

### Resource Name Filtering
```sql
SELECT campaign.id, campaign.name
FROM campaign
WHERE campaign.resource_name = 'customers/1234567/campaigns/987654'
```

### Field Compatibility Notes
- Not all fields work with all resources
- Check field compatibility using Google Ads API field reference
- Use the `list_resources` tool to discover available resources
- Start simple and add complexity gradually

## Official Documentation

[Google Ads Query Structure](https://developers.google.com/google-ads/api/docs/query/structure)