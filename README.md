# mcp-google-ads-gcloud-auth (TypeScript)

Google Ads MCP server with GCloud/ADC auth. Minimal, fast, and ready for Claude/other MCP clients.

Contents
- Prerequisites
- Quick Start
- MCP Clients
- Auth Options
- Tools
- Env Vars
- Development
- Smoke Test

Prerequisites
- A GCP project with the Google Ads API enabled.
- Ensure the credentials you use (user/ADC or service account) have the Service Usage Consumer role on that project (grants `serviceusage.services.use`). This is granted to the account, not the project by default.
- A Google Ads Developer Token is required:
  - Docs: https://developers.google.com/google-ads/api/docs/get-started/dev-token
  - Application form: https://support.google.com/adspolicy/contact/new_token_application

Quick Start
- Install: `npm install && npm run build`
- Run (dev): `npm run dev` (stdio transport)
- Run (built): `node dist/cli.js`

MCP Clients
- Claude Desktop (JSON settings)
  - Add this to your Claude Desktop settings JSON:
```json
{
  "mcpServers": {
    "google-ads": {
      "command": "node",
      "args": ["/absolute/path/to/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_AUTH_TYPE": "adc",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_CUSTOMER_ID": "optional-10-digit-id"
      }
    }
  }
}
```
- CLI usage
  - `node dist/cli.js` uses stdio transport. Point your MCP client to this command.

- Cursor (MCP JSON)
  - Paste into Cursor’s MCP JSON (see docs: https://docs.cursor.com/en/context/mcp#using-mcp-json):
```json
{
  "mcpServers": {
    "google-ads": {
      "command": "node",
      "args": ["/absolute/path/to/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_AUTH_TYPE": "adc",
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_CUSTOMER_ID": "optional-10-digit-id"
      }
    }
  }
}
```

Auth Options
- Use ADC (recommended):
  - `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords`
  - Set `GOOGLE_ADS_AUTH_TYPE=adc`
- Optional CLI token fallback: set `GOOGLE_ADS_GCLOUD_USE_CLI=true`
- OAuth/Service Account remain supported via `GOOGLE_ADS_CREDENTIALS_PATH`.

Tools

- manage_auth
  - Purpose: Inspect and manage auth. Always safe to run with default action `status`.
  - Inputs:
    - `action`: `status` | `switch` | `refresh` (default `status`)
    - `config_name`: gcloud config name (for `switch`)
    - `allow_subprocess`: boolean (default `false`). When `true`, runs gcloud commands.
  - Output: Text summary including env values, ADC probe, Ads scope check, accessible accounts count. For `switch`/`refresh`, prints planned or executed `gcloud` steps.
  - Example (status): `{ "action": "status" }`
  - Example (print steps, don’t run): `{ "action": "refresh" }`
  - Example (execute): `{ "action": "switch", "config_name": "work", "allow_subprocess": true }`

- list_resources
  - Purpose: Discover GAQL FROM resources or list accessible accounts.
  - Inputs:
    - `kind`: `resources` | `accounts` (default `resources`)
    - `filter`: substring for resource names (when `resources`)
    - `limit`: 1–1000 (default 500)
    - `output_format`: `table` | `json` | `csv` (default `table`)
  - Notes: Uses `google_ads_field` metadata for resources (no FROM clause). Accounts come from `customers:listAccessibleCustomers`.
  - Example (resources): `{ "kind": "resources", "filter": "campaign", "limit": 50 }`
  - Example (accounts): `{ "kind": "accounts", "output_format": "table" }`

- execute_gaql_query
  - Purpose: Run raw GAQL with optional pagination.
  - Inputs:
    - `customer_id` (optional). If omitted, tool prompts you to pick one from accessible accounts.
    - `query`: GAQL string
    - Paging: `page_size`, `page_token`, `auto_paginate` (bool), `max_pages` (1–20)
    - `output_format`: `table` | `json` | `csv` (default `table`)
  - Output: Table/JSON/CSV of results. Shows `Next Page Token` when not auto-paginating.
  - Example:
    ```json
    {
      "customer_id": "1234567890",
      "query": "SELECT campaign.id, metrics.clicks FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 10",
      "output_format": "table"
    }
    ```

- get_performance
  - Purpose: Quick performance by level with common filters.
  - Inputs:
    - `customer_id` (optional). If omitted, tool lists accessible accounts to choose from.
    - `level`: `account` | `campaign` | `ad_group` | `ad`
    - `days`: 1–365 (default 30)
    - `limit`: 1–1000 (default 50)
    - Paging: `page_size`, `page_token`, `auto_paginate`, `max_pages`
    - `output_format`: `table` | `json` | `csv` (default `table`)
    - `filters` (optional):
      - `status` (e.g., ENABLED)
      - `nameContains` (entity name contains)
      - `campaignNameContains` (ignored at `account` level)
      - `minClicks`, `minImpressions`
  - Output: Includes `customer.currency_code` and computed `metrics.cost_units`.
  - Examples:
    - Account (last 30 days): `{ "customer_id": "1234567890", "level": "account" }`
    - Campaigns filtered: `{ "level": "campaign", "filters": { "status": "ENABLED", "minClicks": 10 } }`

- gaql_help
  - Purpose: Pull targeted GAQL guidance from Google docs or return an offline cheat sheet.
  - Inputs:
    - `question` (free text)
    - `topics`: subset of `[overview, grammar, structure, date_ranges, case_sensitivity, ordering, cookbook]`
    - `quick_tips`: boolean (default `false`). When `true`, returns an offline tips list (no network).
    - `include_examples`: boolean (best-effort, subject to `max_chars`)
    - `max_chars`: 400–4000 (default 1600)
  - Examples:
    - Offline: `{ "quick_tips": true }`
    - Focused: `{ "question": "date ranges and ordering", "topics": ["date_ranges", "ordering"], "max_chars": 1200 }`

Env Vars
- `GOOGLE_ADS_AUTH_TYPE`: `adc` | `gcloud_cli` | `oauth` | `service_account`
- `GOOGLE_ADS_DEVELOPER_TOKEN`: required for API calls
- Optional: `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_API_VERSION` (default `v19`), `GOOGLE_ADS_GCLOUD_USE_CLI`, `GOOGLE_ADS_CREDENTIALS_PATH`, `GOOGLE_ADS_ACCESS_TOKEN`

Development
- `npm run dev` — run from TS via `tsx`
- `npm run build` — emit ESM to `dist/`
- `npm start` — run compiled CLI
- `npm run typecheck`, `npm run lint`, `npm run test`

Smoke Test (real API)
- Requirements: ADC login + `GOOGLE_ADS_DEVELOPER_TOKEN`
- Commands:
  - `npm run smoke` — lists accounts
  - `SMOKE_CUSTOMER_ID=1234567890 npm run smoke` — plus sample performance

License
MIT
