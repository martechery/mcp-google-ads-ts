# mcp-google-ads-gcloud-auth (TypeScript)

TypeScript implementation of a Model Context Protocol (MCP) server for Google Ads with GCloud/ADC authentication using the official `@modelcontextprotocol/sdk` (no fastmcp).

## Features
- Pure SDK: uses `@modelcontextprotocol/sdk` directly.
- Minimal server scaffolding with stdio transport.
- Tools:
  - `ping`: health check.
  - `get_auth_status`: summarizes auth-related env configuration.
  - `manage_auth` (placeholder): describes next steps for ADC, CLI fallback, OAuth, and Service Accounts.

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

## Roadmap
- Implement Google Ads auth flows:
  - ADC via `google-auth-library` with Ads scope.
  - Optional `gcloud auth print-access-token` fallback.
  - OAuth + Service Account JSON handling.
- Add GAQL query tool and header builder.
- Tests and examples.

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

### Tools Overview
- `execute_gaql_query`: POST a GAQL query to `v19`.
- `list_accounts`: lists accessible accounts (uses ADC/dev token headers).
- `get_performance`: unified performance at `campaign` | `ad_group` | `ad` levels.
  - Inputs: `customer_id`, `level`, optional `days` (default 30), `limit` (default 50), `filters`.
  - Filters: `status`, `nameContains`, `campaignNameContains`, `minClicks`, `minImpressions`.
  - Always includes `customer.currency_code` so costs are interpretable.

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
