# Multi-Tenant Auth for MCP Google Ads (TSD - Final)

## Summary
- Goal: Enable hosted, multi-tenant use of the Google Ads MCP by accepting Google Ads credentials at connection establishment, without filesystem storage.
- Default: Disabled. When `ENABLE_RUNTIME_CREDENTIALS=false`, retain current single-tenant ADC behavior.
- When enabled: Credentials MUST be provided at connection time. NO fallback to ADC/env (security requirement).
- **Deployment Note**: Phase 1 requires sticky sessions for multi-process deployments.

## Core Principles
- **Connection-time auth**: Credentials passed when MCP connection is established
- **Immutable per session**: Cannot change credentials after connection
- **Self-contained**: MCP only handles Google Ads credentials, no external dependencies
- **Unopinionated**: No infrastructure requirements (no Redis, no distributed state)
- **Secure by default**: No fallback to server credentials in multi-tenant mode
- **Application-controlled**: Session IDs managed by application layer
- **Session key security**: UUID v4 format required for entropy
- **Structured errors**: Machine-readable error codes with messages

## Non-Goals
- User authentication/authorization (application's responsibility)
- Session management beyond in-memory (application's responsibility)
- Persisting secrets to local disk
- Building OAuth frontends or user management
- Changing credentials mid-session
- Service account/domain-wide delegation (initial scope)
- Distributed state management (Redis, DynamoDB, etc.)
- Horizontal scaling without sticky sessions

## Configuration (Env)

### Multi-tenant Mode
- `ENABLE_RUNTIME_CREDENTIALS` (default `false`): Enable multi-tenant mode.
- `RUNTIME_CREDENTIAL_TTL` (default `3600`): Seconds before auto-expiry.
- `MAX_CONNECTIONS` (default `1000`): Maximum concurrent connections.
- `CONNECTION_SWEEP_INTERVAL` (default `300`): Seconds between stale connection cleanup.
- `MASK_CREDENTIALS` (default `true`): Mask tokens in responses.
- `ALLOWED_CUSTOMER_IDS` (optional): Comma-separated allowlist for customer_id restrictions.

### Global Settings (Both Modes)
- `GOOGLE_ADS_API_VERSION`: API version used for all connections
- `GOOGLE_OAUTH_CLIENT_ID`: OAuth client ID for refresh token flow
- `GOOGLE_OAUTH_CLIENT_SECRET`: OAuth client secret for refresh token flow
- `HTTPS_PROXY`: Standard proxy for outbound HTTPS calls (including token refresh)
- `NODE_TLS_REJECT_UNAUTHORIZED`: For proxy/cert handling


### Single-tenant Mode Only
- `GOOGLE_ADS_DEVELOPER_TOKEN`: Developer token (not used in multi-tenant)
- `GOOGLE_ADS_MANAGER_ACCOUNT_ID`: Default MCC ID

## Security Model
**CRITICAL**: When `ENABLE_RUNTIME_CREDENTIALS=true`:
- **Credentials required at connection time**
- **Developer token required at runtime** (no env fallback)
- **NO fallback to ADC/env credentials** (prevents credential leakage)
- **Cannot change credentials after connection**
- **Session keys must be UUID v4 format** (36 chars, validated server-side)
- **Invalid grants immediately purged** (no retry for security)
- All tools fail with structured errors if no credentials provided
- Credentials stored in memory only (no external dependencies)
- Auto-expire after TTL
- Connection-scoped isolation
- LRU eviction when MAX_CONNECTIONS reached
- Single-flight refresh to prevent token thrashing
- Optional customer ID allowlisting for additional isolation

## Error Response Format
All errors return structured JSON:
```typescript
interface ErrorResponse {
  error: {
    code: string;      // e.g., "ERR_NO_CREDENTIALS"
    message: string;   // Human-readable description
    details?: any;     // Optional additional context
  }
}
```

## Deployment Architecture

### In-Memory Store Only
- Simple in-memory connection store (Map)
- Requires sticky sessions for multi-instance deployments
- Load balancer must route same client to same server instance
- Applications requiring distributed state must handle it themselves

### Why No Redis/Distributed State?
- Keeps MCP self-contained and unopinionated
- No external dependencies to manage
- Applications can implement their own state management if needed
- Secondary use case doesn't justify the complexity

## Connection Establishment

### Primary Path: Session Key in Tool Calls
All tools accept session_key parameter (most compatible approach):
```typescript
// First tool call establishes session
await mcp.call('set_session_credentials', {
  session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // UUID v4 required
  google_credentials: {
    access_token: 'ya29...',
    refresh_token: '1//...',
    developer_token: 'DEV_TOKEN_REQUIRED',
    login_customer_id: '1234567890',
    quota_project_id: 'my-project' // Optional, for billing
  }
});

// Subsequent calls use session_key
await mcp.call('execute_gaql_query', {
  session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  customer_id: '123456789',
  query: 'SELECT campaign.id FROM campaign'
});
```

### Future: MCP Connection Context
If SDK adds context support, credentials can be passed at connection:
```typescript
// Future enhancement when SDK supports context
const mcpConnection = new MCPClient({
  server: 'mcp-google-ads-ts',
  context: {
    session_key: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    google_credentials: { /* ... */ }
  }
});
```

### Data Model
```typescript
interface GoogleCredential {
  access_token: string;
  refresh_token?: string;
  developer_token: string;  // Required in multi-tenant
  login_customer_id?: string;
  quota_project_id?: string; // For x-goog-user-project header
  expires_at?: number; // epoch ms
}

interface ConnectionContext {
  session_key: string; // Application-provided UUID v4
  credentials: GoogleCredential;
  establishedAt: number;
  lastActivityAt: number;
  refreshPromise?: Promise<GoogleCredential>; // Single-flight refresh
  allowedCustomerIds?: Set<string>; // Optional restriction
}

// Extended to include developer_token
interface AccessToken {
  token: string;
  type: 'env' | 'adc' | 'runtime';
  developer_token?: string;  // Added for multi-tenant
  quotaProjectId?: string;
}
```

### Session Key Validation
```typescript
function validateSessionKey(key: string): boolean {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidV4Regex.test(key)) {
    throw new Error('Session key must be UUID v4 format');
  }
  return true;
}
```

## Tool Availability by Mode

### Single-Tenant Mode (Default)
All existing tools remain available:
- `manage_auth` - Full auth management (oauth_login, refresh, switch, etc.)
- `execute_gaql_query` - Run GAQL queries
- `get_performance` - Get performance metrics
- `list_resources` - List Google Ads resources
- `gaql_help` - Get GAQL help

Credentials can be changed anytime via `manage_auth` tool actions.

### Multi-Tenant Mode Only
When `ENABLE_RUNTIME_CREDENTIALS=true`:

#### set_session_credentials
Establish session with credentials
Input:
```json
{
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "google_credentials": {
    "access_token": "ya29...",
    "refresh_token": "1//...",
    "developer_token": "REQUIRED",
    "login_customer_id": "1234567890"
  }
}
```
Response:
```json
{
  "status": "success",
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "expires_in": 3600
}
```

#### get_credential_status
Check if session has valid credentials
Input:
```json
{
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
Response:
```json
{
  "has_credentials": true,
  "expires_in": 3542,
  "has_refresh_token": true,
  "masked_token": "ya29****fGh2"
}
```

#### refresh_access_token
Refresh the access token using refresh token (if available)
Input:
```json
{
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
Response (success):
```json
{
  "status": "refreshed",
  "expires_in": 3600,
  "masked_token": "ya29****xYz3"
}
```
Response (invalid grant):
```json
{
  "error": {
    "code": "ERR_INVALID_GRANT",
    "message": "Refresh token invalid or revoked. Re-authentication required."
  }
}
```

#### end_session
Explicitly end a session and clean up resources
Input:
```json
{
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```
Response:
```json
{
  "status": "session_ended"
}
```

**Important differences**:
- `manage_auth` tool returns error - cannot change auth in multi-tenant mode
- All tools require `session_key` parameter
- Developer token required at runtime (no env fallback)
- Structured error responses for programmatic handling

## Server Implementation

### Connection Initialization
```typescript
// src/server.ts
const connections = new Map<string, ConnectionContext>();

// Called by set_session_credentials tool
function establishSession(sessionKey: string, credentials: GoogleCredential) {
  if (process.env.ENABLE_RUNTIME_CREDENTIALS !== 'true') {
    throw {
      error: {
        code: 'ERR_NOT_ENABLED',
        message: 'Multi-tenant mode not enabled'
      }
    };
  }

  // Validate session key format
  validateSessionKey(sessionKey);

  if (!credentials.developer_token) {
    throw {
      error: {
        code: 'ERR_NO_DEVELOPER_TOKEN',
        message: 'Developer token required in multi-tenant mode'
      }
    };
  }

  // Parse allowed customer IDs if configured
  const allowedIds = process.env.ALLOWED_CUSTOMER_IDS
    ? new Set(process.env.ALLOWED_CUSTOMER_IDS.split(',').map(id => id.trim()))
    : undefined;

  connections.set(sessionKey, {
    session_key: sessionKey,
    credentials: credentials,
    establishedAt: Date.now(),
    lastActivityAt: Date.now(),
    allowedCustomerIds: allowedIds
  });

  // Start cleanup sweeper if not running
  startConnectionSweeper();

  return sessionKey;
}

// Called by end_session tool
function endSession(sessionKey: string): void {
  connections.delete(sessionKey);
}
```

### `src/auth.ts` changes with OAuth2Client
```typescript
import { OAuth2Client } from 'google-auth-library';

export async function getAccessToken(sessionKey?: string): Promise<AccessToken> {
  const multiTenantEnabled = process.env.ENABLE_RUNTIME_CREDENTIALS === 'true';

  if (multiTenantEnabled) {
    // CRITICAL: No fallback in multi-tenant mode
    if (!sessionKey || !connections.has(sessionKey)) {
      throw {
        error: {
          code: 'ERR_NO_CREDENTIALS',
          message: 'Multi-tenant mode requires credentials at connection'
        }
      };
    }

    const context = connections.get(sessionKey);
    if (!context.credentials) {
      throw {
        error: {
          code: 'ERR_NO_CREDENTIALS',
          message: 'No credentials provided at connection establishment'
        }
      };
    }

    const cred = context.credentials;

    // Check expiry with preemptive refresh window
    if (isExpired(cred, 300)) { // Refresh if <300s remaining
      if (cred.refresh_token) {
        try {
          const refreshed = await singleFlightRefresh(context);
          return {
            token: refreshed.access_token,
            type: 'runtime',
            developer_token: refreshed.developer_token,
            quotaProjectId: cred.quota_project_id
          };
        } catch (error: any) {
          // Handle invalid grant by purging session
          if (error.message?.includes('invalid_grant')) {
            connections.delete(sessionKey);
            throw {
              error: {
                code: 'ERR_INVALID_GRANT',
                message: 'Refresh token invalid or revoked. Re-authentication required.'
              }
            };
          }
          throw error;
        }
      }
      throw {
        error: {
          code: 'ERR_TOKEN_EXPIRED',
          message: 'Access token expired, no refresh token available'
        }
      };
    }

    // Update last activity
    context.lastActivityAt = Date.now();

    return {
      token: cred.access_token,
      type: 'runtime',
      developer_token: cred.developer_token,
      quotaProjectId: cred.quota_project_id
    };
  }

  // Single-tenant mode: existing ADC/env logic
  const result = await getCurrentImplementation();
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    result.developer_token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  }
  return result;
}
```

### Single-Flight Refresh with OAuth2Client
```typescript
async function singleFlightRefresh(context: ConnectionContext): Promise<GoogleCredential> {
  // If refresh already in progress, wait for it
  if (context.refreshPromise) {
    return await context.refreshPromise;
  }

  // Start new refresh with single-flight protection
  context.refreshPromise = refreshTokenWithOAuth2Client(context.credentials)
    .then(refreshed => {
      context.credentials = refreshed;
      context.refreshPromise = undefined;
      return refreshed;
    })
    .catch(error => {
      context.refreshPromise = undefined;
      throw error;
    });

  return await context.refreshPromise;
}

async function refreshTokenWithOAuth2Client(cred: GoogleCredential): Promise<GoogleCredential> {
  const oauth2Client = new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  });

  // Set refresh token
  oauth2Client.setCredentials({
    refresh_token: cred.refresh_token
  });

  try {
    // OAuth2Client handles proxy, retries, and clock skew
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('No access token in refresh response');
    }

    return {
      ...cred,
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date || (Date.now() + 3600000)
    };
  } catch (error: any) {
    // OAuth2Client provides detailed error info
    if (error.message?.includes('invalid_grant')) {
      throw new Error('invalid_grant: Refresh token is invalid or revoked');
    }
    throw error;
  }
}
```

### Customer ID Validation
```typescript
function validateCustomerId(context: ConnectionContext, customerId: string): void {
  if (context.allowedCustomerIds && !context.allowedCustomerIds.has(customerId)) {
    throw {
      error: {
        code: 'ERR_CUSTOMER_NOT_ALLOWED',
        message: `Customer ID ${customerId} not in allowlist for this session`
      }
    };
  }
}
```

### Connection Management
```typescript
// Periodic cleanup of stale connections
let sweeperInterval: NodeJS.Timeout | null = null;

function startConnectionSweeper() {
  if (sweeperInterval) return; // Already running

  sweeperInterval = setInterval(() => {
    const now = Date.now();
    const ttl = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600') * 1000;

    for (const [key, context] of connections.entries()) {
      if (now - context.lastActivityAt > ttl) {
        connections.delete(key);
      }
    }

    // LRU eviction if over limit
    const maxConnections = parseInt(process.env.MAX_CONNECTIONS || '1000');
    if (connections.size > maxConnections) {
      const sorted = Array.from(connections.entries())
        .sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt);

      for (let i = 0; i < sorted.length - maxConnections; i++) {
        connections.delete(sorted[i][0]);
      }
    }
  }, parseInt(process.env.CONNECTION_SWEEP_INTERVAL || '300') * 1000);
}
```

### Tool Handler Updates

#### manage_auth tool
```typescript
async function manageAuthHandler(input: any) {
  // Block in multi-tenant mode
  if (process.env.ENABLE_RUNTIME_CREDENTIALS === 'true') {
    throw {
      error: {
        code: 'ERR_IMMUTABLE_AUTH',
        message: 'Authentication cannot be modified in multi-tenant mode'
      }
    };
  }

  // Single-tenant mode: existing logic works normally
  return existingManageAuthLogic(input);
}
```

#### Other tools with customer ID validation
```typescript
async function executeGaqlHandler(input: any) {
  const sessionKey = extractSessionKey(input);
  const token = await getAccessToken(sessionKey);

  // Validate customer ID if restrictions configured
  if (sessionKey && input.customer_id) {
    const context = connections.get(sessionKey);
    if (context) {
      validateCustomerId(context, input.customer_id);
    }
  }

  // Build headers from extended token
  const headers = {
    'Authorization': `Bearer ${token.token}`,
    'developer-token': token.developer_token,
    ...(token.quotaProjectId && { 'x-goog-user-project': token.quotaProjectId })
  };

  // ... rest of implementation
}

function extractSessionKey(input: any): string | undefined {
  if (process.env.ENABLE_RUNTIME_CREDENTIALS !== 'true') {
    return undefined; // Not needed in single-tenant
  }

  if (!input?.session_key) {
    throw {
      error: {
        code: 'ERR_NO_SESSION_KEY',
        message: 'session_key parameter required in multi-tenant mode'
      }
    };
  }

  return input.session_key;
}
```

## Future: Application-Managed State

If applications need distributed state for horizontal scaling without sticky sessions, they can:

### Option 1: Pass Full Credentials Each Time
Instead of just `session_key`, pass complete credentials on every call:
```typescript
// Application handles all state
await mcp.call('execute_gaql_query', {
  google_credentials: {
    access_token: 'ya29...',
    developer_token: 'DEV_TOKEN',
    // ... full credentials
  },
  customer_id: '123456789',
  query: 'SELECT campaign.id FROM campaign'
});
```

### Option 2: External Session Management
Application implements its own distributed session store:
```typescript
// Application's responsibility
class AppSessionStore {
  async getCredentials(sessionKey: string): Promise<Credentials> {
    // Application fetches from Redis, DynamoDB, etc.
    return await this.redis.get(`session:${sessionKey}`);
  }
}

// Then pass fresh credentials to MCP
const creds = await appStore.getCredentials(sessionKey);
await mcp.call('set_session_credentials', {
  session_key: sessionKey,
  google_credentials: creds
});
```

### Option 3: Proxy Layer
Application adds a stateless proxy that handles session management:
```typescript
// Application proxy handles state, MCP remains simple
ApplicationProxy -> (manages state) -> MCP (stateless)
```

The key principle: MCP stays simple and unopinionated. Applications choose their own complexity.

## Error Handling

### Error Codes and Messages
All errors follow structured format:
- `ERR_NO_CREDENTIALS`: "Multi-tenant mode requires credentials at connection"
- `ERR_TOKEN_EXPIRED`: "Access token expired, no refresh token available"
- `ERR_IMMUTABLE_AUTH`: "Authentication cannot be modified in multi-tenant mode"
- `ERR_NO_DEVELOPER_TOKEN`: "Developer token required in multi-tenant mode"
- `ERR_SESSION_NOT_FOUND`: "Session key not found or expired"
- `ERR_INVALID_SESSION_KEY`: "Session key must be UUID v4 format"
- `ERR_NO_SESSION_KEY`: "session_key parameter required in multi-tenant mode"
- `ERR_INVALID_GRANT`: "Refresh token invalid or revoked. Re-authentication required."
- `ERR_CUSTOMER_NOT_ALLOWED`: "Customer ID not in allowlist for this session"
- `ERR_NOT_ENABLED`: "Multi-tenant mode not enabled"
- `ERR_INSUFFICIENT_SCOPE`: "Token missing required 'adwords' scope. Required scope: https://www.googleapis.com/auth/adwords"

## Token Security
- Mask tokens in all responses (show first 4 + last 4 chars only)
- Never log full tokens or credentials
- Clear from memory on TTL expiry or LRU eviction
- No disk persistence
- Credentials immutable after establishment
- Session keys must have UUID v4 entropy
- Invalid grants immediately purge session

## Network Configuration

### Proxy Support
OAuth2Client automatically respects standard proxy environment variables:
- `HTTPS_PROXY` or `https_proxy`: Proxy for HTTPS requests
- `NO_PROXY` or `no_proxy`: Comma-separated list of hosts to bypass

Example:
```bash
HTTPS_PROXY=http://corporate-proxy:8080 \
NO_PROXY=localhost,127.0.0.1 \
ENABLE_RUNTIME_CREDENTIALS=true \
node dist/server.js
```

## Observability
Log strategy based on context:
- **Application-facing logs/responses**: Include full session_key (application owns it)
- **Internal MCP debug logs**: Hash session keys (SHA256) if shared logging
- **Config option**: `LOG_SESSION_KEYS` (default: true) controls emission policy

Logged information:
- Session keys (full or hashed based on config)
- Tool names and invocation counts
- Error codes with session context
- Connection establishment/cleanup events
- Refresh attempts and outcomes (success/fail only)
- Invalid grant occurrences for monitoring
- Customer IDs (normalized) for debugging

Example application-facing log:
```json
{
  "event": "connection_established",
  "session_key": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Testing Plan

### Unit Tests
- Connection establishment with/without credentials
- Session key validation (UUID v4 format)
- Session key extraction from input
- Credential validation (developer token required)
- TTL expiry and cleanup
- LRU eviction when over limit
- Token masking
- Single-flight refresh (no concurrent refreshes)
- OAuth2Client refresh with mock
- Invalid grant handling and session purge
- Customer ID normalization and allowlist validation
  - Strip dashes: "123-456-789" → "123456789"
  - Handle as strings: 123456789 → "123456789"
  - Case normalization if needed
- Structured error format
- Connection isolation
- AccessToken type includes developer_token
- End session cleanup
- Token scope verification (when enabled)

### Integration Tests
- Connect with credentials → run tools → verify isolation
- Multiple connections with different credentials
- Concurrent refresh attempts (verify single-flight)
- Token refresh flow with OAuth2Client
- Invalid grant → session purge → re-auth required
- Connection cleanup after TTL
- Session key parameter required in all tools
- Error messages for missing/invalid session keys
- Customer ID restrictions when configured
- End session explicitly
- Proxy configuration for OAuth2Client

### Test Helpers
```typescript
// Helper to mock connection establishment
function mockConnection(credentials: GoogleCredential, sessionKey?: string) {
  const key = sessionKey || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  validateSessionKey(key);
  establishSession(key, credentials);
  return key;
}

// Helper to generate valid session keys
function generateSessionKey(): string {
  // Use crypto.randomUUID() in Node 14.17+
  return crypto.randomUUID();
}

// Mock OAuth2Client for testing
class MockOAuth2Client {
  async refreshAccessToken() {
    return {
      credentials: {
        access_token: 'new-token',
        expiry_date: Date.now() + 3600000
      }
    };
  }
}
```

## Usage Examples

### Application Backend
```typescript
import { randomUUID } from 'crypto';

// Application authenticates user and gets their Google Ads credentials
const userCreds = await myApp.getGoogleAdsCredentials(userId);
const sessionKey = randomUUID(); // Generate UUID v4

// First call sets credentials
try {
  await mcp.call('set_session_credentials', {
    session_key: sessionKey,
    google_credentials: {
      access_token: userCreds.access_token,
      refresh_token: userCreds.refresh_token,
      developer_token: userCreds.developer_token, // Required
      login_customer_id: userCreds.mcc_id,
      quota_project_id: 'my-billing-project'
    }
  });
} catch (error) {
  if (error.error?.code === 'ERR_NOT_ENABLED') {
    // Handle multi-tenant not enabled
  }
}

// All subsequent calls include session_key
try {
  const campaigns = await mcp.call('execute_gaql_query', {
    session_key: sessionKey,
    customer_id: '123456789',
    query: 'SELECT campaign.id FROM campaign'
  });
} catch (error) {
  if (error.error?.code === 'ERR_INVALID_GRANT') {
    // Trigger re-authentication flow
    await myApp.reauthenticateUser(userId);
  }
}

// Check credential status if needed
const status = await mcp.call('get_credential_status', {
  session_key: sessionKey
});

if (status.expires_in < 300) {
  await mcp.call('refresh_access_token', {
    session_key: sessionKey
  });
}

// Clean up when done
await mcp.call('end_session', {
  session_key: sessionKey
});
```

### Load Balancer Configuration
For Phase 1 multi-instance deployments:
```nginx
# nginx example with sticky sessions
upstream mcp_backend {
    ip_hash;  # Session affinity based on client IP
    server mcp1.internal:3000;
    server mcp2.internal:3000;
}
```

## Implementation Phases

### Phase 1: Core Implementation
- Session key validation (UUID v4)
- Store credentials with session keys
- Update auth.ts to return extended AccessToken
- Add set_session_credentials tool
- Add get_credential_status tool
- Add end_session tool
- Block manage_auth in multi-tenant mode
- Require developer token at runtime
- Use google-auth-library OAuth2Client
- Structured error responses
- Document sticky session requirement

### Phase 2: Token Refresh & Management
- Add refresh_access_token tool
- Implement single-flight refresh
- OAuth2Client for robust refresh
- Handle invalid grants with session purge
- Connection TTL and sweeper
- LRU eviction
- Optional customer ID allowlisting

### Phase 3: Production Hardening
- Add observability logging
- Quota project support
- Performance optimization
- Load testing with sticky sessions
- Document patterns for application-managed state

## Deliverables
- Update `src/server.ts` with connection management
- Update `src/auth.ts` with OAuth2Client and extended AccessToken
- Add credential management tools to `src/server-tools.ts`
- Add `src/types/connection.ts` for type definitions
- Add `src/types/errors.ts` for error response types
- Add `src/utils/connection-manager.ts` for cleanup logic
- Add `src/utils/session-validator.ts` for UUID validation
- Update README with multi-tenant section and deployment notes
- Unit and integration tests

## Migration Path
1. Default behavior unchanged (single-tenant with ADC)
   - `manage_auth` tool still available with all actions
   - Can change credentials anytime via oauth_login, refresh, etc.
   - ADC/env fallback works normally
2. Set `ENABLE_RUNTIME_CREDENTIALS=true` to enable multi-tenant mode
   - Deploy with sticky sessions (Phase 1 requirement)
   - `manage_auth` tool disabled (returns error)
   - Applications must provide UUID v4 session keys
   - Applications must provide credentials via set_session_credentials
   - Developer token required at runtime
   - No automatic fallback to server credentials (by design)
   - Credentials immutable after establishment
   - Invalid grants trigger re-authentication

## Security Benefits
- Credentials cannot be changed mid-session (prevents hijacking)
- Clear separation between connection establishment and tool usage
- No confusion about credential state during session
- Complete tenant isolation with no env fallback
- Application controls session lifecycle with secure keys
- Single-flight refresh prevents token thrashing
- Invalid grants immediately purged for security
- Optional customer ID restrictions for additional isolation
- No external dependencies that could be compromised
- Aligned with standard multi-tenant patterns

## Implementation Decisions Summary
- **Single-flight refresh**: Per-session Promise map prevents concurrent refreshes
- **Developer token propagation**: Extended AccessToken type includes developer_token
- **State management**: In-memory only, no Redis or external dependencies
- **Multi-process deployments**: Requires sticky sessions (application's choice to add distributed state)
- **Context availability**: Primary path is session_key in tool inputs
- **Session key entropy**: UUID v4 format validated server-side
- **Proxy/egress**: OAuth2Client handles standard proxy env vars
- **End-session API**: Explicit tool for immediate cleanup
- **Error payloads**: Structured JSON with code and message
- **Tenant guardrails**: Optional ALLOWED_CUSTOMER_IDS env var
- **OAuth client library**: google-auth-library's OAuth2Client for robustness
- **Invalid-grant handling**: Immediate purge and distinct error code
- **Self-contained**: MCP remains unopinionated about infrastructure

## Implementation Decisions

### Token Scope Verification
- **Decision**: Optional verification with config flag `VERIFY_TOKEN_SCOPE` (default: false)
- **Implementation**: On first use of session, call `customers.listAccessibleCustomers` to verify `adwords` scope
- **Error**: Return `ERR_INSUFFICIENT_SCOPE` with message about required scope
- **Rationale**: Provides early validation without breaking existing implementations

### Session Key Handling in Logs
- **Decision**: Include full session_key in responses back to application
- **Rationale**: Application provides the session_key, so it already has full access
- **Implementation**:
  - Include session_key in all tool responses and error payloads
  - Include in structured logging/events sent to application
  - Only mask in internal MCP debug logs (if any)
- **Example**: `{ error: { code: "ERR_TOKEN_EXPIRED", session_key: "abc123...", message: "..." }}`

### Credential Re-set Prevention
- **Decision**: Configurable behavior with `STRICT_IMMUTABLE_AUTH` flag
- **Default**: Log warning but allow override (for recovery scenarios)
- **Strict mode**: Return `ERR_IMMUTABLE_AUTH` when attempting to re-set
- **Rationale**: Provides flexibility for development while enabling production strictness

### Token Revocation
- **Decision**: No revocation in MCP - delegate to application layer
- **Rationale**: Keeps MCP focused, avoids network calls on cleanup
- **Implementation**: Clear from memory only; application can revoke before calling `end_session`

## Observability

### Structured Logging
The MCP emits structured JSON events to stderr for application consumption:

```typescript
interface MCPEvent {
  timestamp: string;
  tool: string;                 // Tool or lifecycle event name
  session_key?: string;         // Full key for traceability
  customer_id?: string;         // Customer context
  request_id?: string;          // Correlation ID from application
  response_time_ms: number;
  api_version?: string;         // Google Ads API version (tool calls)
  error?: { code: string; message: string };
  // Lifecycle additions
  overwritten?: boolean;        // session_established when overwriting
  reason?: string;              // session_ended (explicit|ttl|lru|invalid_grant)
  removed_count?: number;       // session_sweep
  // Snapshot metrics
  active_sessions?: number;
  total_established?: number;
  total_refreshes?: number;
  refresh_failures?: number;
  avg_session_age_ms?: number;
  oldest_session_age_ms?: number;
}
```

### Metrics to Track
- Request counts by tool and customer
- Response time percentiles (p50, p95, p99)
- Error rates by type
- Active session count
- Token refresh/success/failure rates
- Lifecycle: session_established/ended/sweep counts
- Cache hit rates (future)

### Integration Approach
- Emit structured logs to stderr (12-factor app pattern)
- Application captures and routes to observability platform
- No OpenTelemetry dependency initially (can add as opt-in later)
- Correlation IDs flow through for distributed tracing

## Implementation Notes

### Customer ID Normalization
Normalize customer IDs before allowlist checks to prevent mismatches:
```typescript
function normalizeCustomerId(id: string | number): string {
  // Convert to string and remove dashes
  return String(id).replace(/-/g, '');
}

// Example usage:
// "123-456-789" → "123456789"
// 123456789 → "123456789"
// "1234-5678-9" → "123456789"
```

This ensures consistent matching regardless of format variations in customer IDs.

## Status Checklist

Completed (implemented, tested, and pushed)
- In-memory session store with TTL, LRU sweeper, and UUID v4 validation
  - Files: `src/utils/connection-manager.ts`, `src/utils/session-validator.ts`, `src/types/connection.ts`
- Multi-tenant gating: tools require `session_key`; `manage_auth` disabled
  - Files: `src/server-tools.ts`
  - Tests: `test/unit/multitenant.gating.test.ts`, `test/unit/multitenant.requireSessionKey.test.ts`
- Session tools: `set_session_credentials`, `get_credential_status`, `end_session`
  - Files: `src/server-tools.ts`, `src/schemas.ts`
  - Tests: `test/unit/multitenant.session.tools.test.ts`
- Developer token propagation and headers wiring; quota project header support
  - Files: `src/auth.ts`, `src/headers.ts`, tools under `src/tools/*`
- Token refresh: `refresh_access_token` tool with single-flight OAuth2Client
  - Files: `src/utils/connection-manager.ts`, `src/server-tools.ts`, `src/schemas.ts`
  - Tests: `test/unit/multitenant.refresh.test.ts`
- Auto-refresh on use when expiring (<5m) in `getAccessToken`
  - Files: `src/auth.ts`
- Customer ID allowlist enforcement per session (`ALLOWED_CUSTOMER_IDS`)
  - Files: `src/utils/connection-manager.ts`, `src/server-tools.ts`
  - Tests: `test/unit/multitenant.allowlist.test.ts`
- Optional scope verification (`VERIFY_TOKEN_SCOPE=true`) at session establish
  - Files: `src/utils/connection-manager.ts`, `src/server-tools.ts`
  - Tests: `test/unit/multitenant.scopeVerify.test.ts`
- Observability: structured JSON events for tools and lifecycle
  - Files: `src/utils/observability.ts`, `src/types/observability.ts`, `src/server-tools.ts`, `src/utils/connection-manager.ts`
  - Events: tool calls, token_refresh, session_established, session_ended (explicit|ttl|lru|invalid_grant), session_sweep, metrics_snapshot
- Strict immutability toggle (`STRICT_IMMUTABLE_AUTH`) with error mapping
  - Files: `src/utils/connection-manager.ts`, `src/server-tools.ts`
  - Tests: `test/unit/multitenant.strictImmutable.test.ts`
- Per-session rate limiting (token bucket) in multi-tenant mode
  - Files: `src/utils/rate-limiter.ts`, `src/utils/connection-manager.ts`, `src/server-tools.ts`
  - Tests: `test/unit/multitenant.rateLimit.test.ts`
- Documentation updated
  - README: Multi-Tenant Mode, session tools, refresh tool, VERIFY_TOKEN_SCOPE
  - README: Observability toggles, error payloads; Rate Limiting section and ERR_RATE_LIMITED payload

Validated
- Lint: clean
- Typecheck: clean
- Unit tests: passing (including new multi-tenant tests)
- Integration tests: passing (live suite, includes multi-tenant flow)

Remaining / Next
- Additional hardening/perf: load testing with sticky sessions; micro-optimizations
- Optional: richer error payloads across remaining tools (fully uniform)
- Circuit breaker for repeated token refresh failures (fast-fail window)
- Additional metrics: rate_limit_hits counter in snapshots
