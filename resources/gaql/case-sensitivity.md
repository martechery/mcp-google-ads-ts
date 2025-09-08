# GAQL Case Sensitivity

Understanding case sensitivity rules in Google Ads Query Language is crucial for accurate filtering.

## Basic Rules

### Field Names (Case-Insensitive)
Field names are **case-insensitive** - these are equivalent:
```sql
campaign.name = 'Test Campaign'
CAMPAIGN.NAME = 'Test Campaign'  
Campaign.Name = 'Test Campaign'
```

### String Values (Case-Sensitive)
String values in conditions are **case-sensitive** - these are different:
```sql
campaign.name = 'Test Campaign'     -- Matches "Test Campaign" 
campaign.name = 'test campaign'     -- Matches "test campaign"
campaign.name = 'TEST CAMPAIGN'     -- Matches "TEST CAMPAIGN"
```

## Operator-Specific Behavior

### Equality and Comparison Operators
`=`, `!=`, `<`, `>`, `>=`, `<=` are all case-sensitive for string values:

```sql
-- These will return different results
WHERE campaign.name = 'Brand Campaign'
WHERE campaign.name = 'brand campaign'  
WHERE campaign.name = 'BRAND CAMPAIGN'
```

### LIKE Operator
The `LIKE` operator is case-sensitive:
```sql
-- Case-sensitive pattern matching
WHERE campaign.name LIKE 'Brand%'        -- Matches "Brand Campaign"
WHERE campaign.name LIKE 'brand%'        -- Matches "brand campaign"  
WHERE campaign.name LIKE '%BRAND%'       -- Matches "MY BRAND CAMPAIGN"
```

### IN Operator
Values in `IN` lists are case-sensitive:
```sql
-- These are different
WHERE campaign.name IN ('Brand', 'Search', 'Display')
WHERE campaign.name IN ('brand', 'search', 'display')
```

### REGEXP_MATCH
Regular expressions are case-sensitive by default:
```sql
-- Case-sensitive regex
WHERE campaign.name REGEXP_MATCH 'Brand.*'      -- Matches "Brand Campaign"
WHERE campaign.name REGEXP_MATCH 'brand.*'      -- Matches "brand campaign"

-- Case-insensitive regex (using RE2 syntax)
WHERE campaign.name REGEXP_MATCH '(?i)brand.*'  -- Matches both
```

## Enum Values

Enum values are case-sensitive and should use exact Google Ads API values:

```sql
-- ✅ Correct enum values
WHERE campaign.status = 'ENABLED'
WHERE campaign.advertising_channel_type = 'SEARCH'
WHERE segments.device = 'MOBILE'

-- ❌ Incorrect case
WHERE campaign.status = 'enabled'
WHERE campaign.advertising_channel_type = 'search'  
WHERE segments.device = 'mobile'
```

## Common Enum Values

### Campaign Status
- `ENABLED`
- `PAUSED` 
- `REMOVED`

### Advertising Channel Type
- `SEARCH`
- `DISPLAY`
- `SHOPPING`
- `YOUTUBE`
- `VIDEO`

### Device Types
- `DESKTOP`
- `MOBILE`
- `TABLET`
- `CONNECTED_TV`

### Ad Group Status  
- `ENABLED`
- `PAUSED`
- `REMOVED`

## Best Practices

### 1. Use Exact Enum Values
Always use the exact case from Google Ads API documentation:
```sql
-- Good
WHERE ad_group.status = 'ENABLED'

-- Bad  
WHERE ad_group.status = 'Enabled'
```

### 2. Be Explicit with String Matching
If you need case-insensitive string matching, use regex:
```sql
-- Case-insensitive campaign name search
WHERE campaign.name REGEXP_MATCH '(?i)brand.*campaign'
```

### 3. Use LIKE for Pattern Matching
```sql
-- Find campaigns starting with "Brand" (case-sensitive)
WHERE campaign.name LIKE 'Brand%'

-- Find campaigns containing "test" anywhere (case-sensitive)  
WHERE campaign.name LIKE '%test%'
```

### 4. Consider Data Consistency
Ensure your campaign/ad group names follow consistent casing conventions to make filtering predictable.

## Troubleshooting

### Common Issues
1. **No results returned**: Check case of enum values
2. **Unexpected filtering**: Verify string value case
3. **Pattern matching fails**: Confirm LIKE pattern case

### Debug Techniques
```sql
-- Check actual values first
SELECT DISTINCT campaign.status FROM campaign LIMIT 10

-- Then filter with exact case
WHERE campaign.status = 'ENABLED'
```

## Official Documentation

[Google Ads Query Case Sensitivity](https://developers.google.com/google-ads/api/docs/query/case-sensitivity)