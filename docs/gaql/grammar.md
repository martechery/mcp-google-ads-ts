# GAQL Grammar Reference

Google Ads Query Language follows a SQL-like grammar with specific syntax rules.

## Grammar Structure (Regular Expression Notation)

```
Query -> SelectClause FromClause WhereClause? OrderByClause? LimitClause? ParametersClause?

SelectClause -> SELECT FieldName (, FieldName)*
FromClause -> FROM ResourceName
WhereClause -> WHERE Condition (AND Condition)*
OrderByClause -> ORDER BY Ordering (, Ordering)*
LimitClause -> LIMIT PositiveInteger
ParametersClause -> PARAMETERS Literal=Value (, Literal=Value)*

Condition -> FieldName Operator Value
Operator -> = | != | < | > | >= | <= | IN | NOT IN | 
           LIKE | NOT LIKE | CONTAINS ANY | CONTAINS ALL |
           CONTAINS NONE | IS NULL | IS NOT NULL | DURING |
           BETWEEN | REGEXP_MATCH | NOT REGEXP_MATCH

Value -> Literal | LiteralList | Number | NumberList | String |
         StringList | Function

Ordering -> FieldName (ASC | DESC)?

FieldName -> [a-z]([a-zA-Z0-9._])*
ResourceName -> [a-z]([a-zA-Z_])*

StringList -> (String (, String)*)
LiteralList -> (Literal (, Literal)*)
NumberList -> (Number (, Number)*)

PositiveInteger -> [1-9]([0-9])*
Number -> -?[0-9]+(.[0-9][0-9]*)?
String -> (' Char* ') | (" Char* ")
Literal -> [a-zA-Z0-9_]*

Function -> LAST_14_DAYS | LAST_30_DAYS | LAST_7_DAYS |
           LAST_BUSINESS_WEEK | LAST_MONTH | LAST_WEEK_MON_SUN |
           LAST_WEEK_SUN_SAT | THIS_MONTH | THIS_WEEK_MON_TODAY |
           THIS_WEEK_SUN_TODAY | TODAY | YESTERDAY
```

## Key Grammar Notes

- `?` indicates an optional element
- `*` means zero or more; `+` means one or more
- `(xxxxx)` indicates a grouping
- `[a-z0-9]` signifies character ranges
- `|` stands for "or"

## Important Rules and Limitations

### REGEXP_MATCH Operator
- Uses [RE2 syntax](https://github.com/google/re2/wiki/Syntax)
- More restrictive than PCRE or other regex flavors

### LIKE Operator
- Can only be used on string fields, not arrays
- To match literal `[`, `]`, `%`, or `_`, surround in square brackets:
```sql
campaign.name LIKE '[[]Earth[_]to[_]Mars[]]%'
```

### Field and Resource Naming
- **Field names**: Start with lowercase, can contain letters, numbers, dots, underscores
- **Resource names**: Start with lowercase, can contain letters and underscores

### Operators by Category

**Comparison**: `=`, `!=`, `<`, `>`, `>=`, `<=`
**List**: `IN`, `NOT IN`
**String**: `LIKE`, `NOT LIKE`, `REGEXP_MATCH`, `NOT REGEXP_MATCH`
**Array**: `CONTAINS ANY`, `CONTAINS ALL`, `CONTAINS NONE`
**Null**: `IS NULL`, `IS NOT NULL`
**Date/Time**: `DURING`, `BETWEEN`

## Common Grammar Patterns

```sql
-- Basic selection
SELECT campaign.id, campaign.name FROM campaign

-- With conditions
SELECT campaign.name FROM campaign WHERE campaign.status = 'ENABLED'

-- Multiple conditions
SELECT campaign.name FROM campaign 
WHERE campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'

-- With ordering and limit
SELECT campaign.name FROM campaign 
WHERE campaign.status = 'ENABLED' 
ORDER BY campaign.name ASC 
LIMIT 100
```

## Official Documentation

[Google Ads Query Language Grammar](https://developers.google.com/google-ads/api/docs/query/grammar)