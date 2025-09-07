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

Tools (high level)
- `manage_auth`: environment summary, ADC probe, optional `gcloud` switch/refresh hints.
- `list_resources`: GAQL FROM-able resources or accessible accounts.
- `execute_gaql_query`: run GAQL with pagination.
- `get_performance`: quick performance by level with filters.

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
