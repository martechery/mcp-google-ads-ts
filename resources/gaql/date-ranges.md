# GAQL Date Ranges

Google Ads Query Language supports multiple ways to specify date ranges for time-based filtering.

## Date Range Methods

### 1. Custom Date Range

Use specific dates in ISO 8601 format (`YYYY-MM-DD` or `YYYYMMDD`):

```sql
-- Extended format (recommended)
WHERE segments.date BETWEEN '2024-01-01' AND '2024-01-31'

-- Basic format
WHERE segments.date >= '20241001' AND segments.date <= '20241031'
```

### 2. Predefined Date Ranges

Use the `DURING` operator with predefined constants:

```sql
WHERE segments.date DURING LAST_30_DAYS
```

#### Available Predefined Ranges

| Range | Description |
|-------|-------------|
| `TODAY` | Today only |
| `YESTERDAY` | Yesterday only |
| `LAST_7_DAYS` | Last 7 days (not including today) |
| `LAST_14_DAYS` | Last 14 days (not including today) |
| `LAST_30_DAYS` | Last 30 days (not including today) |
| `LAST_BUSINESS_WEEK` | Previous Monday-Friday business week |
| `THIS_MONTH` | All days in current month |
| `LAST_MONTH` | All days in previous month |
| `THIS_WEEK_SUN_TODAY` | Previous Sunday to today |
| `THIS_WEEK_MON_TODAY` | Previous Monday to today |
| `LAST_WEEK_SUN_SAT` | Previous Sunday-Saturday week |
| `LAST_WEEK_MON_SUN` | Previous Monday-Sunday week |

### 3. Predefined Time Periods

For time period segments, use the first day of the period:

```sql
-- Month filtering (use first day of month)
WHERE segments.month = '2024-05-01'

-- Week filtering (use first day of week)  
WHERE segments.week = '2024-05-06'

-- Quarter filtering (use first day of quarter)
WHERE segments.quarter = '2024-01-01'
```

**Important**: Must use the exact first day of the time period, or you'll get a `MISALIGNED_DATE_FOR_FILTER` error.

## Common Date Range Patterns

### Recent Performance
```sql
-- Last 7 days performance
SELECT campaign.name, segments.date, metrics.clicks
FROM campaign 
WHERE segments.date DURING LAST_7_DAYS

-- Last 30 days performance  
SELECT campaign.name, metrics.impressions, metrics.clicks
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
```

### Specific Time Periods
```sql
-- Specific month
SELECT campaign.name, metrics.conversions
FROM campaign
WHERE segments.date BETWEEN '2024-05-01' AND '2024-05-31'

-- Year-to-date  
SELECT campaign.name, metrics.cost_micros
FROM campaign
WHERE segments.date BETWEEN '2024-01-01' AND '2024-12-31'
```

### Weekly/Monthly Analysis
```sql
-- Weekly breakdown
SELECT campaign.name, segments.week, metrics.clicks
FROM campaign
WHERE segments.week = '2024-05-06'

-- Monthly trends
SELECT campaign.name, segments.month, metrics.impressions  
FROM campaign
WHERE segments.month IN ('2024-01-01', '2024-02-01', '2024-03-01')
```

## Core Date Segment Rules

When selecting core date segments, you **must** include a date filter in WHERE:

**Core date segments**: `segments.date`, `segments.week`, `segments.month`, `segments.quarter`, `segments.year`

```sql
-- ✅ Correct: date segment with date filter
SELECT campaign.name, segments.date, metrics.clicks
FROM campaign  
WHERE segments.date DURING LAST_30_DAYS

-- ❌ Error: date segment without date filter
SELECT campaign.name, segments.date, metrics.clicks
FROM campaign
```

## Date Format Guidelines

- **ISO 8601 Extended**: `YYYY-MM-DD` (recommended)
- **ISO 8601 Basic**: `YYYYMMDD` (also valid)
- **Time periods**: Use first day of period only
- **Inclusive ranges**: BETWEEN includes both start and end dates

## Performance Considerations

- Predefined ranges (`LAST_30_DAYS`) are more efficient than custom ranges
- Shorter date ranges return faster
- Use appropriate time segments for your analysis granularity

## Official Documentation

[Google Ads Query Date Ranges](https://developers.google.com/google-ads/api/docs/query/date-ranges)