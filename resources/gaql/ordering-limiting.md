# GAQL Ordering and Limiting

Control the order and quantity of results returned by your GAQL queries.

## ORDER BY Clause

Sort results by one or more fields in ascending or descending order.

### Basic Syntax
```sql
ORDER BY field_name [ASC|DESC]
```

### Single Field Ordering
```sql
-- Ascending (default)
SELECT campaign.name, metrics.clicks
FROM campaign
ORDER BY metrics.clicks

-- Descending  
SELECT campaign.name, metrics.clicks
FROM campaign
ORDER BY metrics.clicks DESC

-- Explicit ascending
SELECT campaign.name, metrics.clicks
FROM campaign
ORDER BY metrics.clicks ASC
```

### Multiple Field Ordering
Order by multiple fields - sorting occurs in the sequence specified:

```sql
SELECT campaign.name, ad_group.name, metrics.impressions, metrics.clicks
FROM ad_group
ORDER BY 
  campaign.name ASC,
  metrics.impressions DESC,
  metrics.clicks DESC
```

This query sorts by:
1. Campaign name (ascending)
2. Then impressions (descending)  
3. Then clicks (descending)

## LIMIT Clause

Restrict the number of results returned.

### Basic Syntax
```sql
LIMIT positive_integer
```

### Simple Limiting
```sql
-- Get top 10 campaigns by clicks
SELECT campaign.name, metrics.clicks
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.clicks DESC
LIMIT 10
```

### Common LIMIT Patterns

**Top Performers**
```sql
SELECT campaign.name, metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND campaign.status = 'ENABLED'
ORDER BY metrics.conversions DESC
LIMIT 20
```

**Sample Data**
```sql  
SELECT campaign.name, campaign.status
FROM campaign
LIMIT 5
```

**Large Dataset Control**
```sql
SELECT ad_group_criterion.keyword.text, metrics.clicks
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.clicks DESC
LIMIT 1000
```

## Advanced Ordering Patterns

### Cost Efficiency Ordering
```sql
-- Order by cost per click (calculated field concept)
SELECT 
  campaign.name,
  metrics.clicks,
  metrics.cost_micros,
  metrics.average_cpc
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
  AND metrics.clicks > 0
ORDER BY metrics.average_cpc ASC
LIMIT 25
```

### Performance Ranking
```sql
-- Multi-metric performance ranking
SELECT 
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.conversions
FROM campaign  
WHERE segments.date DURING LAST_7_DAYS
  AND campaign.status = 'ENABLED'
ORDER BY 
  metrics.conversions DESC,
  metrics.clicks DESC,
  metrics.impressions DESC
LIMIT 50
```

### Alphabetical with Performance
```sql
-- Alphabetical primary, performance secondary
SELECT 
  ad_group.name,
  campaign.name,
  metrics.cost_micros
FROM ad_group
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group.status = 'ENABLED'
ORDER BY 
  campaign.name ASC,
  ad_group.name ASC,
  metrics.cost_micros DESC
LIMIT 100
```

## Field Requirements

### Orderable Fields
Only fields marked as "sortable" in the API reference can be used in ORDER BY:

**Common Sortable Fields**
- Resource IDs: `campaign.id`, `ad_group.id`
- Names: `campaign.name`, `ad_group.name`  
- Metrics: `metrics.clicks`, `metrics.impressions`, `metrics.cost_micros`
- Dates: `segments.date`, `segments.week`

### ORDER BY Restrictions
- Field must be sortable (check API reference)
- Field should generally be in SELECT clause (best practice)
- Some fields may not be sortable despite being selectable

## Performance Considerations

### Ordering Impact
- **No ORDER BY**: Fastest, results in natural order
- **Single field ORDER BY**: Moderate performance impact
- **Multiple field ORDER BY**: Higher performance cost
- **Large LIMIT values**: Minimal additional cost over no limit

### Best Practices
1. **Order by indexed fields** when possible (IDs, names)
2. **Combine ORDER BY with LIMIT** for top-N queries
3. **Avoid ordering** large result sets unless necessary  
4. **Use appropriate LIMIT** values - don't fetch more than needed

### Efficient Top-N Patterns
```sql
-- Efficient: Order + Limit together
SELECT campaign.name, metrics.clicks
FROM campaign
ORDER BY metrics.clicks DESC
LIMIT 20

-- Less efficient: Large result set ordering
SELECT campaign.name, metrics.clicks  
FROM campaign
ORDER BY metrics.clicks DESC
-- No LIMIT - sorts all results
```

## Common Use Cases

### Performance Rankings
```sql
-- Top converting campaigns
SELECT campaign.name, metrics.conversions
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY metrics.conversions DESC
LIMIT 10
```

### Quality Analysis  
```sql
-- Lowest quality score keywords
SELECT 
  ad_group_criterion.keyword.text,
  ad_group_criterion.quality_info.quality_score,
  metrics.impressions
FROM keyword_view
WHERE segments.date DURING LAST_30_DAYS
  AND ad_group_criterion.status = 'ENABLED'
ORDER BY ad_group_criterion.quality_info.quality_score ASC
LIMIT 50
```

### Budget Analysis
```sql
-- Highest spend campaigns
SELECT 
  campaign.name,
  metrics.cost_micros,
  campaign_budget.amount_micros
FROM campaign
WHERE segments.date DURING LAST_7_DAYS
ORDER BY metrics.cost_micros DESC
LIMIT 25
```

### Time-based Analysis
```sql
-- Recent performance trends
SELECT 
  segments.date,
  metrics.clicks,
  metrics.impressions,
  metrics.cost_micros
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY segments.date DESC
LIMIT 30
```

## Official Documentation

📖 [Google Ads Query Ordering and Limiting](https://developers.google.com/google-ads/api/docs/query/ordering-limiting)