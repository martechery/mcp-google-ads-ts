# mcp-google-ads-gcloud-auth (TypeScript)

TypeScript implementation of a Model Context Protocol (MCP) server for Google Ads with GCloud/ADC authentication using the official `@modelcontextprotocol/sdk` (no fastmcp).

## Features
- Pure SDK: uses `@modelcontextprotocol/sdk` directly.
- Minimal server scaffolding with stdio transport.
- Tools:
  - `manage_auth`: combines env summary + probes; actions include `status` (summarize env, probe ADC + Ads scope), `switch` and `refresh` (optional subprocess; prints exact `gcloud` commands when disabled).
  - `list_accounts`: lists accessible Ads accounts (customers:listAccessibleCustomers).
  - `list_resources`: GAQL FROM discovery via `google_ads_field` (category=RESOURCE).
  - `execute_gaql_query`: run GAQL with pagination support.
  - `get_performance`: unified performance with filters, currency code, and cost in units.

## Install
```
# from this sub-repo directory
npm install
npm run build
```

## Run (stdio)
```
# via built binary
npx mcp-google-ads-gcloud-auth

# or
node dist/cli.js

# dev (requires tsx)
npm run dev
```

## Configure (environment)
- `GOOGLE_ADS_AUTH_TYPE`: `adc` | `gcloud_cli` | `oauth` | `service_account`
- `GOOGLE_ADS_GCLOUD_USE_CLI`: `true`/`false` – optional CLI token fallback
- `GOOGLE_ADS_CREDENTIALS_PATH`: required for `oauth` and `service_account` modes
- `GOOGLE_ADS_CUSTOMER_ID`: Ads customer ID
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID`: manager account (optional)
- `GOOGLE_ADS_DEVELOPER_TOKEN`: developer token
 - `GOOGLE_ADS_ACCESS_TOKEN`: optional override (dev/tests) when not using ADC
 - `GOOGLE_ADS_API_VERSION`: optional API version override (default `v19`). Example: `v21`

Notes:
- Prefer ADC (`adc`) over CLI fallback for stability and automatic refresh.
- Credentials path is not required for `adc`/`gcloud_cli`.
- Keep `oauth` and `service_account` for compatibility.

## MCP Client Config Example (Claude Desktop JSON)
```json
{
  "mcpServers": {
    "google-ads-ts": {
      "command": "node",
      "args": ["/absolute/path/to/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_AUTH_TYPE": "adc",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "...",
        "GOOGLE_ADS_CUSTOMER_ID": "..."
      }
    }
  }
}
```

## Current Capabilities
- Auth via ADC (preferred) with optional `gcloud` subprocess actions through `manage_auth`.
- GAQL execution with `page_size`/`page_token`; outputs `Next Page Token` when present.
- `list_resources` to help construct valid GAQL FROM clauses.
- Error mapping for common 400/401/403 responses with actionable hints.
- Performance results include `customer.currency_code` and `metrics.cost_units` (micros→units).

## License
MIT (can be changed upon preference).

## Development

### Scripts (pnpm)
- `pnpm dev`: run server with stdio (tsx)
- `pnpm build`: compile to `dist/`
- `pnpm start`: run compiled CLI
- `pnpm test`: unit + integration (mocked) tests
- `pnpm run typecheck`: TypeScript check
- `pnpm run lint`: ESLint check
- `pnpm run smoke`: real-world smoke against Google Ads (ADC required)

### Tools Overview (Schemas via Zod)
- Notes: Tool input schemas are defined centrally with Zod and compiled to JSON Schema. We avoid top-level `oneOf`/`allOf`/`anyOf` for Claude/Anthropic compatibility (see `test/schemaGuard.test.ts`).

- `manage_auth`:
  - Inputs: `action` = `status` | `switch` | `refresh`; `config_name` (for switch); `allow_subprocess` (default false).
  - Without subprocess, prints exact `gcloud` commands to run. With subprocess, executes them and verifies scope.
- `list_resources`:
  - Inputs: `kind` = `resources` | `accounts` (default `resources`); optional `filter` (substring), `limit` (default 500), `output_format` = `table`|`json`|`csv`.
  - When `kind=resources`, lists FROM-able resources using google_ads_field; when `kind=accounts`, lists accessible account IDs.
- `list_accounts`:
  - Alias of `list_resources` with `kind=accounts`.
- `execute_gaql_query`:
  - Inputs: `customer_id`, `query`, optional `page_size`, `page_token`, `auto_paginate` (bool), `max_pages` (1–20), `output_format` = `table`|`json`|`csv`.
  - Prints table/JSON/CSV, `Next Page Token` when paging manually, or `Pages fetched` when auto-paginating.
- `get_performance`:
  - Inputs: `customer_id`, `level` (`campaign` | `ad_group` | `ad`), optional `days` (30), `limit` (50), `filters`, `page_size`, `page_token`, `auto_paginate`, `max_pages`, `output_format`.
  - Filters: `status`, `nameContains`, `campaignNameContains`, `minClicks`, `minImpressions`.
  - Output includes `customer.currency_code` and computed `metrics.cost_units`.

### GAQL Help
- `gaql_help`: Returns targeted GAQL guidance from docs. Inputs: `question`, `topics[]`, `quick_tips` (offline), `include_examples`, `max_chars`.

### Smoke Test (real API)
Requires ADC and a developer token. Make sure:
- `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords`
- `export GOOGLE_ADS_DEVELOPER_TOKEN=...`

Run:
```
pnpm run smoke            # lists accounts
SMOKE_CUSTOMER_ID=1234567890 pnpm run smoke   # also fetches sample performance
```

### Optional Real Integration Tests
Skip by default. To run locally with real API calls:
```
export REAL_ADS_TEST=true
export GOOGLE_ADS_DEVELOPER_TOKEN=...
pnpm test
```

## Examples

- manage_auth (status):
  - Input: `{ "action": "status" }`
  - Output includes environment summary, ADC probe, Ads scope check, and accessible accounts count.

- manage_auth (switch without subprocess):
  - Input: `{ "action": "switch", "config_name": "work" }`
  - Output prints: `gcloud config configurations activate work` (no execution).

- execute_gaql_query with pagination:
  - Input: `{ "customer_id": "1234567890", "query": "SELECT campaign.id FROM campaign LIMIT 1", "page_size": 1000 }`
  - Output prints a table and optionally `Next Page Token: ...`.

- get_performance with filters:
  - Input: `{ "customer_id": "1234567890", "level": "campaign", "days": 30, "filters": { "status": "ENABLED" } }`
  - Output includes `customer.currency_code` and computed `metrics.cost_units`.
