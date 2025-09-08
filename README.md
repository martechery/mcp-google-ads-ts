# MCP Server for Google Ads

[![npm version](https://img.shields.io/npm/v/mcp-google-ads-ts.svg)](https://www.npmjs.com/package/mcp-google-ads-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

TypeScript implementation of an MCP server for Google Ads API with GCloud/ADC authentication. Provides tools for campaign management, performance reporting, and account operations.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Client-Specific Instructions](#client-specific-instructions)
- [Available Tools](#available-tools)
  - [1. manage_auth](#1-manage_auth---authentication-management)
  - [2. list_resources](#2-list_resources---list-google-ads-resources)
  - [3. execute_gaql_query](#3-execute_gaql_query---execute-google-ads-query-language-queries)
  - [4. get_performance](#4-get_performance---get-performance-metrics)
  - [5. gaql_help](#5-gaql_help---google-ads-query-language-reference)
- [Advanced Configuration](#advanced-configuration)
- [Development](#development)
- [License](#license)

## Prerequisites

- Node.js 18+ and npm
- A GCP project with the Google Ads API enabled
- Ensure the credentials you use (user/ADC or service account) have the Service Usage Consumer role on that project (grants `serviceusage.services.use`)
- A Google Ads Developer Token is required:
  - [Documentation](https://developers.google.com/google-ads/api/docs/get-started/dev-token)
  - [Application form](https://support.google.com/adspolicy/contact/new_token_application)

## Quick Start

### 1. Install and run the MCP server

#### Using npx (Recommended)

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx",
      "args": ["mcp-google-ads-ts"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_ACCOUNT_ID": "optional-10-digit-id"
      }
    }
  }
}
```

#### Using local installation

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "node",
      "args": ["/path/to/mcp-google-ads-ts/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_ACCOUNT_ID": "optional-10-digit-id"
      }
    }
  }
}
```

### 2. Set up authentication

The server supports Application Default Credentials (ADC) via gcloud:

```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords
```

## Configuration

### Environment Variables

```env
# Required
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token

# Optional
GOOGLE_ADS_ACCOUNT_ID=1234567890          # Default account ID
GOOGLE_ADS_GCLOUD_USE_CLI=true           # Use CLI token fallback
GOOGLE_APPLICATION_CREDENTIALS=/path/to/adc.json  # Custom ADC file path
```

## Client-Specific Instructions

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx",
      "args": ["mcp-google-ads-ts"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",
        "GOOGLE_ADS_ACCOUNT_ID": "optional-10-digit-id"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add google-ads -e GOOGLE_ADS_DEVELOPER_TOKEN=your-token -- npx mcp-google-ads-ts
```

### Other MCP Clients

Consult your client's documentation for MCP server configuration. The key details:

- **Command**: `npx mcp-google-ads-ts` or `node /path/to/dist/cli.js`
- **Required env**: `GOOGLE_ADS_DEVELOPER_TOKEN`
- **Optional env**: `GOOGLE_ADS_ACCOUNT_ID`, `GOOGLE_ADS_GCLOUD_USE_CLI`, `GOOGLE_APPLICATION_CREDENTIALS`

## Available Tools

### 1. `manage_auth` - Authentication management

```typescript
{
  allow_subprocess?: boolean  // Allow gcloud command execution (default: true)
}
```

Manages Google Ads API authentication. Checks current authentication status, validates tokens, and can execute gcloud commands to fix authentication issues.

### 2. `list_resources` - List Google Ads resources

```typescript
{
  kind: string,              // Required: Resource type (accounts, campaigns, ad_groups, ads, etc.)
  customer_id?: string,      // Customer ID (uses default if not specified)
  parent_id?: string,        // Parent resource ID for hierarchical resources
  output_format?: string     // Output format (table, json, csv)
}
```

Lists various Google Ads resources like accounts, campaigns, ad groups, ads, keywords, etc.

### 3. `execute_gaql_query` - Execute Google Ads Query Language queries

```typescript
{
  query: string,             // Required: GAQL query
  customer_id?: string,      // Customer ID (uses default if not specified)
  output_format?: string,    // Output format (table, json, csv)
  page_size?: number,        // Results per page (default: 1000)
  page_token?: string,       // Pagination token
  auto_paginate?: boolean,   // Auto-paginate through all results
  max_pages?: number         // Maximum pages to fetch
}
```

Executes custom GAQL queries for advanced data retrieval and analysis.

### 4. `get_performance` - Get performance metrics

```typescript
{
  level: string,             // Required: Reporting level (account, campaign, ad_group, ad, keyword)
  customer_id?: string,      // Customer ID (uses default if not specified)
  date_range?: string,       // Date range (LAST_7_DAYS, LAST_30_DAYS, etc.)
  days?: number,             // Custom days back from today
  metrics?: string[],        // Specific metrics to retrieve
  segments?: string[],       // Segmentation dimensions
  filters?: object,          // Query filters
  output_format?: string,    // Output format (table, json, csv)
  page_size?: number,        // Results per page
  auto_paginate?: boolean    // Auto-paginate through all results
}
```

Retrieves performance metrics and reports for campaigns, ad groups, ads, and keywords.

### 5. `gaql_help` - Google Ads Query Language reference

```typescript
{
  topic?: string,            // Specific help topic
  search?: string            // Search term for help content
}
```

Provides help and documentation for Google Ads Query Language (GAQL), including available resources, fields, functions, and operators.

## Advanced Configuration

### Authentication Options

#### Application Default Credentials (Recommended)
```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords
```

#### Existing ADC File
Set `GOOGLE_APPLICATION_CREDENTIALS` to point to your ADC JSON file, or place it at `.auth/adc.json` in the project directory.

#### CLI Token Fallback
Set `GOOGLE_ADS_GCLOUD_USE_CLI=true` to enable gcloud CLI token fallback for authentication.

### Error Handling

The server includes comprehensive error handling and mapping for Google Ads API errors, providing clear error messages and suggestions for resolution.

## Development

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-username/mcp-google-ads-ts.git
cd mcp-google-ads-ts
npm install
cp .env.example .env  # Configure your environment variables

# 2. Development commands
npm run dev    # Development mode
npm test       # Run tests
npm run lint   # Check code quality
npm run build  # Production build

# 3. Add to your MCP client (See "Using local installation")
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires real Google Ads API access)
VITEST_REAL=1 npm run test:integration

# All tests
npm test
```

### Project Structure

```
src/
├── cli.ts              # CLI entry point
├── server.ts           # MCP server implementation
├── server-tools.ts     # Tool implementations
├── auth.ts             # Authentication handling
├── schemas.ts          # Zod schemas for validation
├── headers.ts          # API request headers
├── tools/              # Individual tool implementations
│   ├── accounts.ts
│   ├── fields.ts
│   ├── gaql.ts
│   ├── performance.ts
│   └── oauth.ts
└── utils/              # Utility functions
    ├── currency.ts
    ├── errorMapping.ts
    ├── exec.ts
    ├── formatCsv.ts
    ├── formatTable.ts
    └── formatCustomerId.ts
```

## License

MIT