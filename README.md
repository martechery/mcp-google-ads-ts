# MCP Server for Google Ads

[![npm version](https://img.shields.io/npm/v/mcp-google-ads-ts.svg)](https://www.npmjs.com/package/mcp-google-ads-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

TypeScript implementation of an MCP server for Google Ads API with GCloud/ADC authentication. Provides tools for campaign management, performance reporting, and account operations with Multi-Customer Center (MCC) support.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Environment Variables](#environment-variables)
- [Client-Specific Instructions](#client-specific-instructions)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [VS Code](#vs-code)
  - [Local Installation](#local-installation)
- [Available Tools](#available-tools)
  - [1. manage_auth](#1-manage_auth---authentication-management)
  - [2. list_resources](#2-list_resources---list-google-ads-resources)
  - [3. execute_gaql_query](#3-execute_gaql_query---execute-google-ads-query-language-queries)
  - [4. get_performance](#4-get_performance---get-performance-metrics)
  - [5. gaql_help](#5-gaql_help---google-ads-query-language-reference)
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

### Using npx (Recommended)

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx", 
      "args": ["mcp-google-ads-ts"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",       // Required: Your Google Ads Developer Token
        "GOOGLE_ADS_ACCOUNT_ID": "1234567890",                // Optional: Default customer ID (10 digits, no dashes)
        "GOOGLE_ADS_MANAGER_ACCOUNT_ID": "9876543210"         // Optional: MCC account ID for login customer
      }
    }
  }
}
```

## Authentication

The server uses Google Application Default Credentials (ADC) for secure authentication. This is the recommended approach as it provides automatic token refresh and secure credential management.

### How Authentication Works

1. **Application Default Credentials (ADC)**: The server first attempts to use ADC, which automatically finds credentials in this order:
   - Environment variable `GOOGLE_APPLICATION_CREDENTIALS` pointing to a credential file
   - User credentials from `gcloud auth application-default login`
   - Service account attached to the compute resource (GCE, Cloud Functions, etc.)

2. **CLI Token Fallback**: If enabled with `GOOGLE_ADS_GCLOUD_USE_CLI=true`, the server can fall back to using `gcloud auth print-access-token` for authentication

3. **Automatic Token Refresh**: Both methods handle token refresh automatically

### Setting Up Authentication

#### Method 1: ADC via gcloud (Recommended)
```bash
gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords
```

#### Method 2: Service Account Key File
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

#### Method 3: Existing ADC File
Place your ADC file at `.auth/adc.json` in the project directory, or set `GOOGLE_APPLICATION_CREDENTIALS` to point to your ADC JSON file.

## Environment Variables

### Required

- **`GOOGLE_ADS_DEVELOPER_TOKEN`**: Your Google Ads API developer token (required for all API calls)

### Optional

- **`GOOGLE_ADS_ACCOUNT_ID`** (optional): Default Google Ads account ID (10-digit customer ID without dashes). Used as the default customer for all operations when not specified explicitly.

- **`GOOGLE_ADS_MANAGER_ACCOUNT_ID`** (optional): For Multi-Customer Center (MCC) accounts - the manager account ID that acts as the login customer. Required when accessing accounts under an MCC. This is typically your MCC account ID (10-digit numeric ID, no dashes).

- **`GOOGLE_ADS_GCLOUD_USE_CLI`** (optional): Set to `true` to enable gcloud CLI token fallback authentication. When enabled, the server will try to get access tokens using `gcloud auth print-access-token` if ADC is not available.

- **`GOOGLE_APPLICATION_CREDENTIALS`** (optional): Path to a Google service account key file or ADC credentials file. Takes precedence over default ADC locations.

- **`GOOGLE_ADS_QUOTA_PROJECT_ID`** (optional): GCP project ID used for quota/billing. Helps avoid 403 errors due to missing quota. Typically your active gcloud project ID.

- **`GOOGLE_ADS_API_VERSION`** (optional): API version string (e.g., v19, v20, v21). Defaults to v19 if unset.

- **`GOOGLE_OAUTH_CLIENT_ID`** and **`GOOGLE_OAUTH_CLIENT_SECRET`** (optional): Desktop OAuth client credentials used by `manage_auth` with `action: "oauth_login"` to create local ADC. Only needed if you cannot use gcloud.

- **`GOOGLE_ADS_ACCESS_TOKEN`** (optional): Direct access token for development/testing. When set, bypasses ADC. Not recommended for production use as tokens don't auto-refresh.

### Example Configuration
```env
# Required
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token-here

# Optional - Default account
GOOGLE_ADS_ACCOUNT_ID=1234567890

# Optional - For MCC accounts
GOOGLE_ADS_MANAGER_ACCOUNT_ID=9876543210

# Optional - Authentication
GOOGLE_ADS_GCLOUD_USE_CLI=true
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

## Client-Specific Instructions

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\\Claude\\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx",
      "args": ["mcp-google-ads-ts"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",       // Required: Your Google Ads Developer Token
        "GOOGLE_ADS_ACCOUNT_ID": "1234567890",                // Optional: Default customer ID (10 digits, no dashes)
        "GOOGLE_ADS_MANAGER_ACCOUNT_ID": "9876543210",        // Optional: MCC account ID for login customer
        "GOOGLE_ADS_QUOTA_PROJECT_ID": "my-gcp-project"       // Optional: GCP project for quota/billing
      }
    }
  }
}
```

### Claude Code

Install and configure with a single command:

```bash
# Required
claude mcp add google-ads \\
  -e GOOGLE_ADS_DEVELOPER_TOKEN=your-token \\
  -- npx mcp-google-ads-ts

# With optional parameters
claude mcp add google-ads \\
  -e GOOGLE_ADS_DEVELOPER_TOKEN=your-token \\
  -e GOOGLE_ADS_ACCOUNT_ID=1234567890 \\
  -e GOOGLE_ADS_MANAGER_ACCOUNT_ID=9876543210 \\
  -e GOOGLE_ADS_QUOTA_PROJECT_ID=my-gcp-project \\
  -- npx mcp-google-ads-ts
```

For more details, see the [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp#installing-mcp-servers).

### Cursor

Add to your MCP settings in Cursor. Go to Cursor Settings > Features > Model Context Protocol:

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "npx",
      "args": ["mcp-google-ads-ts"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",       // Required: Your Google Ads Developer Token
        "GOOGLE_ADS_ACCOUNT_ID": "1234567890",                // Optional: Default customer ID (10 digits, no dashes)
        "GOOGLE_ADS_MANAGER_ACCOUNT_ID": "9876543210",        // Optional: MCC account ID for login customer
        "GOOGLE_ADS_API_VERSION": "v19"                       // Optional: API version (defaults to v19)
      }
    }
  }
}
```

For detailed setup instructions, see the [Cursor MCP documentation](https://docs.cursor.com/en/context/mcp).

### VS Code

Install the MCP extension and add the server configuration:

1. Install the "MCP Manager" extension from the marketplace
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run "MCP: Add Server"
4. Configure the server:

```json
{
  "name": "google-ads",
  "command": "npx",
  "args": ["mcp-google-ads-ts"],
  "env": {
    "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",       // Required: Your Google Ads Developer Token
    "GOOGLE_ADS_ACCOUNT_ID": "1234567890",                // Optional: Default customer ID (10 digits, no dashes)
    "GOOGLE_ADS_MANAGER_ACCOUNT_ID": "9876543210",        // Optional: MCC account ID for login customer
    "GOOGLE_ADS_GCLOUD_USE_CLI": "true"                   // Optional: Enable gcloud CLI token fallback
  }
}
```

For more information, see the [VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

### Local Installation

For local development or when you want to run from source:

#### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/your-username/mcp-google-ads-ts.git
cd mcp-google-ads-ts

# Install dependencies
npm install

# Build the project
npm run build
```

#### 2. Configure Your MCP Client

```json
{
  "mcpServers": {
    "google-ads": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-google-ads-ts/dist/cli.js"],
      "env": {
        "GOOGLE_ADS_DEVELOPER_TOKEN": "YOUR_DEV_TOKEN",       // Required: Your Google Ads Developer Token
        "GOOGLE_ADS_ACCOUNT_ID": "1234567890",                // Optional: Default customer ID (10 digits, no dashes)
        "GOOGLE_ADS_MANAGER_ACCOUNT_ID": "9876543210",        // Optional: MCC account ID for login customer
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/adc.json" // Optional: Path to ADC credentials file
      }
    }
  }
}
```

#### 3. Development Mode

For development with auto-reload:

```bash
npm run dev
```

## Available Tools

### 1. `manage_auth` - Authentication management

```typescript
{
  action?: 'status' | 'switch' | 'refresh' | 'oauth_login' | 'set_project' | 'set_quota_project',  // Action to perform (default: 'status')
  config_name?: string,        // For 'switch' action: gcloud configuration name
  project_id?: string,         // For 'set_project' and 'set_quota_project' actions
  project?: string,            // Alias for project_id
  allow_subprocess?: boolean   // Allow gcloud command execution (default: true)
}
```

**Comprehensive authentication management tool** with multiple actions:

#### `action: 'status'` (default)
- **Environment inspection**: Shows all Google Ads environment variables
- **ADC file discovery**: Locates and validates Application Default Credentials files
- **Token validation**: Checks access token presence and scopes via Google OAuth2 API
- **Scope verification**: Tests Google Ads API access by calling `listAccessibleCustomers`
- **Account enumeration**: Counts accessible customer accounts under current credentials
- **Troubleshooting hints**: Provides guidance when authentication issues are detected

#### `action: 'oauth_login'`
- **Device OAuth flow**: Interactive browser-based authentication using OAuth client credentials
- **Requires env vars**: `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`
- **Saves ADC file**: Creates `authorized_user` JSON at `.auth/adc.json` 
- **Scope validation**: Automatically verifies Google Ads API access after completion
- **Sets credentials**: Updates `GOOGLE_APPLICATION_CREDENTIALS` for immediate use

#### `action: 'switch'`
- **Configuration switching**: Changes active gcloud configuration
- **Requires**: `config_name` parameter
- **Auto-execution**: Runs `gcloud config configurations activate <name>` when `allow_subprocess=true`
- **Guidance**: Provides next steps for refreshing ADC credentials with correct scopes

#### `action: 'refresh'`
- **Credential refresh**: Re-authenticates ADC with required Google Ads scopes
- **Auto-execution**: Runs `gcloud auth application-default login` with proper scopes
- **Token verification**: Prints access token to verify successful authentication
- **Scope testing**: Validates Google Ads API access after refresh

#### `action: 'set_project'`
- **Project configuration**: Sets default GCP project for gcloud
- **Requires**: `project_id` parameter
- **Command**: `gcloud config set project <project_id>`

#### `action: 'set_quota_project'`
- **Quota project setup**: Sets ADC quota project for billing attribution
- **Requires**: `project_id` parameter  
- **Command**: `gcloud auth application-default set-quota-project <project_id>`

#### Safety Features
- **Dry-run mode**: Set `allow_subprocess: false` to see planned commands without execution
- **gcloud detection**: Automatically checks for gcloud CLI availability before execution
- **Error handling**: Provides clear error messages and installation links when gcloud is missing
- **Timeout protection**: Commands have built-in timeouts to prevent hanging

**Example usage:**
```typescript
// Check authentication status
manage_auth

// Refresh credentials with Google Ads scopes  
manage_auth { "action": "refresh" }

// Switch gcloud configuration
manage_auth { "action": "switch", "config_name": "my-project" }

// OAuth login using client credentials
manage_auth { "action": "oauth_login" }

// Dry-run mode (show commands without executing)
manage_auth { "action": "refresh", "allow_subprocess": false }
```

### 2. `list_resources` - List Google Ads resources

```typescript
{
  kind: string,              // Required: Resource type (accounts, campaigns, ad_groups, ads, etc.)
  customer_id?: string,      // Customer ID (uses default if not specified)
  parent_id?: string,        // Parent resource ID for hierarchical resources
  output_format?: string     // Output format (table, json, csv)
}
```

Lists various Google Ads resources with support for hierarchical relationships and multiple output formats.

**Supported resource types:**
- `accounts` - List accessible customer accounts
- `campaigns` - List campaigns
- `ad_groups` - List ad groups
- `ads` - List ads
- `keywords` - List keywords
- `extensions` - List ad extensions

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

Executes custom GAQL queries for advanced data retrieval and analysis with automatic pagination support.

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

Retrieves performance metrics and reports for campaigns, ad groups, ads, and keywords with flexible filtering and segmentation.

### 5. `gaql_help` - Google Ads Query Language reference

```typescript
{
  topic?: string,            // Specific help topic
  search?: string            // Search term for help content
}
```

Provides interactive help and documentation for Google Ads Query Language (GAQL), including available resources, fields, functions, and operators.

## Development

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-username/mcp-google-ads-ts.git
cd mcp-google-ads-ts
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your credentials

# 3. Development commands
npm run dev     # Development mode with auto-reload
npm test        # Run all tests
npm run build   # Production build
npm run lint    # Check code quality
```

### Running Tests

```bash
# Unit tests only
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
│   ├── accounts.ts     # Account listing
│   ├── fields.ts       # Google Ads field metadata
│   ├── gaql.ts         # GAQL query execution
│   ├── performance.ts  # Performance reporting
│   └── oauth.ts        # Authentication management
└── utils/              # Utility functions
    ├── currency.ts     # Currency formatting
    ├── errorMapping.ts # API error handling
    ├── exec.ts         # Command execution
    ├── formatCsv.ts    # CSV formatting
    ├── formatTable.ts  # Table formatting
    └── formatCustomerId.ts  # Customer ID formatting
```

## License

MIT