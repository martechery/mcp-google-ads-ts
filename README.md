# Google Ads MCP

Google Ads MCP server with GCloud/ADC auth.

## Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [MCP Clients](#mcp-clients)
- [Auth Options](#auth-options)
- [Tools](#tools)
- [Env Vars](#env-vars)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

## Prerequisites
- A GCP project with the Google Ads API enabled.
- Ensure the credentials you use (user/ADC or service account) have the Service Usage Consumer role on that project (grants `serviceusage.services.use`). This is granted to the account, not the project by default.
- A Google Ads Developer Token is required:
  - Docs: https://developers.google.com/google-ads/api/docs/get-started/dev-token
  - Application form: https://support.google.com/adspolicy/contact/new_token_application

## Quick Start
- Package manager: pnpm recommended (pnpm-lock.yaml committed). npm also works.
- Install: `pnpm install && pnpm build` (or `npm install && npm run build`)
- Run (dev): `pnpm dev` (stdio transport)
- Run (built): `node dist/cli.js`

## MCP Clients
- Claude Desktop (JSON settings)
  - Add this to your Claude Desktop settings JSON:
```json
{
  "mcpServers": {
    "google-ads": {
      "command": "node",
      "args": ["/absolute/path/to/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_ACCOUNT_ID": "optional-10-digit-id"
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
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_ACCOUNT_ID": "optional-10-digit-id"
      }
    }
  }
}
```

## Auth Options
- Preferred: ADC via gcloud CLI
  - Install gcloud and run:
    - `gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords`
- ADC is the default auth path; no special env flag required.
  - Note: If you already have an ADC file (authorized_user JSON), point to it with `GOOGLE_APPLICATION_CREDENTIALS=/path/to/adc.json`.
- Optional CLI token fallback: set `GOOGLE_ADS_GCLOUD_USE_CLI=true`
- Other modes (raw OAuth client JSON, service accounts) are not supported here. Google Ads requires user OAuth; service accounts are generally not accepted.

### Existing ADC File (no gcloud)
- If you already have an `authorized_user` ADC JSON:
  - Set `GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/adc.json`.
  - Or place it at `.auth/adc.json` in this project; startup auto-detects it.

### Optional: OAuth Client (no gcloud)
- If you cannot install gcloud, you can complete OAuth via device flow and create an ADC file locally.
- Set env vars to your Desktop-app OAuth client:
  - `GOOGLE_OAUTH_CLIENT_ID=...`
  - `GOOGLE_OAUTH_CLIENT_SECRET=...`
- Prompt your LLM to run the tool action:
  - `manage_auth` with `{ "action": "oauth_login" }`
- This will:
  - Prompt you to open a URL and enter a code.
  - Save an ADC `authorized_user` JSON at `.auth/adc.json` (0600 perms).
  - Set `GOOGLE_APPLICATION_CREDENTIALS` in-process and verify Ads scope.
  - Next startups auto-detect `.auth/adc.json`, so you usually don’t need to export anything.

## Tools

Note: You don’t run tool payloads yourself — your MCP client’s LLM calls tools. Use natural prompts (for example: “Check my Google Ads auth status”) and the client will invoke the right tool. JSON shown below is for integrators building custom clients.

- manage_auth
  - Purpose: Inspect and manage auth. Always safe to run with default action `status`.
  - Inputs:
    - `action`: `status` | `switch` | `refresh` (default `status`)
    - `config_name`: gcloud config name (for `switch`)
    - `allow_subprocess`: boolean (default true). Set to `false` to only print commands (no execution).
  - Output: Text summary including env values, ADC probe, Ads scope check, accessible accounts count. For `switch`/`refresh`, executes `gcloud` by default (or prints commands if `allow_subprocess=false`).
  - Behavior: If gcloud is not found on PATH, the tool falls back to printing the exact commands and an install link. If `GOOGLE_OAUTH_CLIENT_ID/SECRET` are present, use `{ "action": "oauth_login" }` to complete OAuth locally and create an ADC file.
  - Example (status): `{ "action": "status" }`
  - Example (print steps, don’t run): `{ "action": "refresh" }`
  - Example (execute): `{ "action": "switch", "config_name": "work", "allow_subprocess": true }`

  - How to ask your MCP client:
    - “Check Google Ads auth status.”
    - “Refresh ADC auth for Google Ads (open login).”
    - “Switch gcloud config to ‘work’ and refresh ADC.”
    - “Create local ADC via OAuth using my client ID/secret.”

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

  - How to ask your MCP client:
    - “List GAQL FROM resources containing ‘campaign’ (limit 50).”
    - “List my accessible Google Ads accounts.”

- execute_gaql_query
  - Purpose: Run raw GAQL with optional pagination.
  - Inputs:
    - `customer_id` (optional). If omitted, tool prompts you to pick one from accessible accounts.
    - `query`: GAQL string
    - Paging: `page_size`, `page_token`, `auto_paginate` (bool), `max_pages` (1–20)
    - `output_format`: `table` | `json` | `csv` (default `table`)
  - Output: Table/JSON/CSV of results. Shows `Next Page Token` when not auto-paginating.
  - How to ask your MCP client:
    - “Run GAQL on 1234567890: SELECT campaign.id, metrics.clicks FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 10.”
    - “Run that query and give me CSV.”
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
  - How to ask your MCP client:
    - “Show account-level performance for 1234567890 (last 30 days).”
    - “Show campaign performance, only ENABLED, min 10 clicks.”
  - Examples:
    - Account (last 30 days): `{ "customer_id": "1234567890", "level": "account" }`
    - Campaigns filtered: `{ "level": "campaign", "filters": { "status": "ENABLED", "minClicks": 10 } }`

- gaql_help
  - Purpose: Provide GAQL guidance using an offline-first cheat sheet plus best-effort official docs.
  - Defaults:
    - Offline-first hybrid behavior. Includes `docs/gaql.md` and, when reachable, pulls relevant snippets from official GAQL docs.
    - No environment configuration required; the LLM can steer with inputs only.
  - Inputs:
    - `question` (free text)
    - `topics`: subset of `[overview, grammar, structure, date_ranges, case_sensitivity, ordering, cookbook]`
    - `quick_tips`: boolean (default `false`). When `true`, returns a concise offline tips list only.
    - `include_examples`: boolean (biases toward code blocks and increases returned snippet count)
    - `max_chars`: 400–8000 (default ~1800; may expand slightly when `include_examples=true`)
  - Output:
    - “Sources” section listing `docs/gaql.md` and any official docs used, followed by condensed, high-signal snippets.
  - How to ask your MCP client:
    - “Give me GAQL quick tips.”
    - “GAQL help on date ranges and ordering with examples.”
  - Examples:
    - Quick tips only: `{ "quick_tips": true }`
    - Focused help: `{ "question": "date ranges and ordering", "topics": ["date_ranges", "ordering"], "include_examples": true }`

## Env Vars
- Required
  - `GOOGLE_ADS_DEVELOPER_TOKEN` — your Google Ads developer token
- Recommended
- Optional
  - `GOOGLE_APPLICATION_CREDENTIALS` — path to an ADC authorized_user JSON (or place file at `.auth/adc.json`)
  - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` — enables `manage_auth { action: "oauth_login" }` (device flow) to create `.auth/adc.json`
  - `GOOGLE_ADS_ACCOUNT_ID` — default 10-digit account ID
  - `GOOGLE_ADS_MANAGER_ACCOUNT_ID` — manager account ID (MCC) when acting through a manager
  - `GOOGLE_ADS_API_VERSION` — default `v19`
  - Note: `gaql_help` does not require any env flags; it runs with a sensible offline-first default and lists its sources.
  - `GOOGLE_ADS_ACCESS_TOKEN` — dev/test override token (bypasses ADC)

## Development
- `npm run dev` — run from TS via `tsx`
- `npm run build` — emit ESM to `dist/`
- `npm start` — run compiled CLI
- `npm run typecheck`, `npm run lint`, `npm run test`

## Testing
- Unit tests (fast, mocked):
  - `pnpm test` or `pnpm run test:unit`
- Integration tests (real API, read-only):
  - Prereqs: ADC login (`gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords`) and `GOOGLE_ADS_DEVELOPER_TOKEN` set
  - Optional: `GOOGLE_ADS_MANAGER_ACCOUNT_ID` (MCC login-customer), `GOOGLE_ADS_ACCOUNT_ID` (target account)
  - Run: `pnpm run test:integration`
  - Notes: Queries use small `LIMIT`s and short date ranges to minimize quota usage

## License
MIT
