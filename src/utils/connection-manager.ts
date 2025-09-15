import { ConnectionContext, GoogleCredential } from '../types/connection.js';
import { validateSessionKey } from './session-validator.js';
import { formatCustomerId } from './formatCustomerId.js';
import { buildAdsHeaders } from '../headers.js';
import { normalizeApiVersion } from './normalizeApiVersion.js';
import { emitMcpEvent, nowIso } from './observability.js';
import { TokenBucket } from './rate-limiter.js';

const connections = new Map<string, ConnectionContext>();
let sweeperInterval: NodeJS.Timeout | null = null;
let totalSessionCount = 0;
let refreshCount = 0;
let refreshFailureCount = 0;
let lastMetricsEmit = 0;

function isMultiTenantEnabled(): boolean {
  return process.env.ENABLE_RUNTIME_CREDENTIALS === 'true';
}

function isRateLimitingEnabled(): boolean {
  const v = (process.env.ENABLE_RATE_LIMITING || 'true').toLowerCase();
  return v !== 'false' && v !== '0';
}

export function establishSession(sessionKey: string, credentials: GoogleCredential): { session_key: string; expires_in: number; overwritten?: boolean } {
  if (!isMultiTenantEnabled()) {
    throw new Error('Multi-tenant mode not enabled');
  }
  validateSessionKey(sessionKey);
  if (!credentials.developer_token) {
    throw new Error('Developer token required in multi-tenant mode');
  }

  const allowedIds = process.env.ALLOWED_CUSTOMER_IDS
    ? new Set(
        process.env.ALLOWED_CUSTOMER_IDS
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((id) => formatCustomerId(id))
      )
    : undefined;

  const now = Date.now();
  const existed = connections.has(sessionKey);
  if (existed) {
    if (process.env.STRICT_IMMUTABLE_AUTH === 'true') {
      throw new Error('ERR_IMMUTABLE_AUTH: Authentication cannot be modified for this session');
    }
    // Non-strict: allow overwrite (for recovery) and log via caller
    const ctx = connections.get(sessionKey)!;
    ctx.credentials = credentials;
    ctx.lastActivityAt = now;
    ctx.allowedCustomerIds = allowedIds;
    // best-effort log
    try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_established', session_key: sessionKey, response_time_ms: 0, overwritten: true }); } catch (e) { void e; }
  } else {
    const rl = isRateLimitingEnabled()
      ? new TokenBucket(
          parseInt(process.env.RATE_LIMIT_BURST || '20', 10),
          parseFloat(process.env.REQUESTS_PER_SECOND || '10')
        )
      : undefined;
    connections.set(sessionKey, {
      session_key: sessionKey,
      credentials,
      establishedAt: now,
      lastActivityAt: now,
      allowedCustomerIds: allowedIds,
      rateLimiter: rl,
    });
    totalSessionCount++;
    try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_established', session_key: sessionKey, response_time_ms: 0, overwritten: false }); } catch (e) { void e; }
  }
  startConnectionSweeper();

  const ttlSec = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600', 10);
  return { session_key: sessionKey, expires_in: ttlSec, overwritten: existed };
}

export function getConnection(sessionKey: string): ConnectionContext | undefined {
  return connections.get(sessionKey);
}

export function touchConnection(sessionKey: string): void {
  const ctx = connections.get(sessionKey);
  if (ctx) ctx.lastActivityAt = Date.now();
}

export function endSession(sessionKey: string): void {
  connections.delete(sessionKey);
  try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_ended', session_key: sessionKey, response_time_ms: 0, reason: 'explicit' }); } catch (e) { void e; }
}

export function startConnectionSweeper(): void {
  if (sweeperInterval) return;
  sweeperInterval = setInterval(() => {
    const now = Date.now();
    const ttlMs = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600', 10) * 1000;
    let removed = 0;
    for (const [key, ctx] of connections.entries()) {
      if (now - ctx.lastActivityAt > ttlMs) {
        connections.delete(key);
        removed++;
        try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_ended', session_key: key, response_time_ms: 0, reason: 'ttl' }); } catch (e) { void e; }
      }
    }

    const max = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);
    if (connections.size > max) {
      const sorted = Array.from(connections.entries()).sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt);
      for (let i = 0; i < sorted.length - max; i++) {
        const key = sorted[i][0];
        connections.delete(key);
        removed++;
        try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_ended', session_key: key, response_time_ms: 0, reason: 'lru' }); } catch (e) { void e; }
      }
    }
    if (removed > 0) { try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_sweep', response_time_ms: 0, removed_count: removed }); } catch (e) { void e; } }

    if ((process.env.EMIT_SESSION_METRICS || 'true').toLowerCase() !== 'false') {
      const interval = parseInt(process.env.METRICS_INTERVAL || '60000', 10);
      if (now - lastMetricsEmit > interval) {
        lastMetricsEmit = now;
        const m = getSessionMetrics();
        try { emitMcpEvent({ timestamp: nowIso(), tool: 'metrics_snapshot', response_time_ms: 0, active_sessions: m.active_sessions, total_established: m.total_established, total_refreshes: m.total_refreshes, refresh_failures: m.refresh_failures, avg_session_age_ms: m.avg_session_age_ms, oldest_session_age_ms: m.oldest_session_age_ms }); } catch (e) { void e; }
      }
    }
  }, parseInt(process.env.CONNECTION_SWEEP_INTERVAL || '300', 10) * 1000);
}

export function getCredentialStatus(sessionKey: string): { has_credentials: boolean; expires_in: number; has_refresh_token: boolean; masked_token: string } {
  const ttlSec = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600', 10);
  const ctx = connections.get(sessionKey);
  if (!ctx) return { has_credentials: false, expires_in: 0, has_refresh_token: false, masked_token: '' };
  const token = ctx.credentials.access_token || '';
  const masked = token.length > 8 ? `${token.slice(0, 4)}****${token.slice(-4)}` : '****';
  return {
    has_credentials: true,
    expires_in: ttlSec,
    has_refresh_token: !!ctx.credentials.refresh_token,
    masked_token: masked,
  };
}

export function requireSessionKeyIfEnabled(input: any): string | undefined {
  if (!isMultiTenantEnabled()) return undefined;
  const key = input?.session_key;
  if (!key) throw new Error('session_key parameter required in multi-tenant mode');
  validateSessionKey(String(key));
  return String(key);
}

export function isCustomerAllowedForSession(sessionKey: string, customerId: string | number): boolean {
  const ctx = connections.get(sessionKey);
  if (!ctx || !ctx.allowedCustomerIds) return true;
  return ctx.allowedCustomerIds.has(formatCustomerId(customerId));
}

async function refreshTokenWithOAuth2Client(cred: GoogleCredential): Promise<GoogleCredential> {
  const clientId = (process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) throw new Error('OAuth client credentials not set');

  const { OAuth2Client } = await import('google-auth-library');
  const oauth2Client = new OAuth2Client({ clientId, clientSecret });
  oauth2Client.setCredentials({ refresh_token: cred.refresh_token });
  try {
    const { credentials } = await (oauth2Client as any).refreshAccessToken();
    if (!credentials?.access_token) throw new Error('No access token in refresh response');
    return {
      ...cred,
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date || (Date.now() + 3600 * 1000),
    };
  } catch (e: any) {
    const msg = String(e?.message || e);
    if (msg.includes('invalid_grant')) {
      throw new Error('invalid_grant: Refresh token is invalid or revoked');
    }
    throw e;
  }
}

export async function refreshAccessTokenForSession(sessionKey: string): Promise<GoogleCredential> {
  const ctx = connections.get(sessionKey);
  if (!ctx) throw new Error('No session found');
  const cred = ctx.credentials;
  if (!cred.refresh_token) throw new Error('No refresh token available');
  if (ctx.refreshPromise) return ctx.refreshPromise;

  ctx.refreshPromise = refreshTokenWithOAuth2Client(cred)
    .then((updated) => {
      ctx.credentials = updated;
      ctx.refreshPromise = undefined;
      refreshCount++;
      try { emitMcpEvent({ timestamp: nowIso(), tool: 'token_refresh', session_key: sessionKey, response_time_ms: 0 }); } catch (e) { void e; }
      return updated;
    })
    .catch((err) => {
      ctx.refreshPromise = undefined;
      // Purge on invalid_grant per security model
      if (String(err?.message || '').includes('invalid_grant')) {
        connections.delete(sessionKey);
        try { emitMcpEvent({ timestamp: nowIso(), tool: 'session_ended', session_key: sessionKey, response_time_ms: 0, reason: 'invalid_grant' }); } catch (e) { void e; }
      }
      refreshFailureCount++;
      try { emitMcpEvent({ timestamp: nowIso(), tool: 'token_refresh', session_key: sessionKey, response_time_ms: 0, error: { code: 'ERR_REFRESH_FAILED', message: String(err?.message || err) } }); } catch (e) { void e; }
      throw err;
    });

  return ctx.refreshPromise;
}

export function getSessionMetrics(): { active_sessions: number; total_established: number; total_refreshes: number; refresh_failures: number; avg_session_age_ms: number; oldest_session_age_ms: number } {
  const now = Date.now();
  let totalAge = 0;
  let oldest = 0;
  let count = 0;
  for (const ctx of connections.values()) {
    const age = now - (ctx.establishedAt || now);
    totalAge += age;
    oldest = Math.max(oldest, age);
    count++;
  }
  const avg = count > 0 ? Math.round(totalAge / count) : 0;
  return {
    active_sessions: connections.size,
    total_established: totalSessionCount,
    total_refreshes: refreshCount,
    refresh_failures: refreshFailureCount,
    avg_session_age_ms: avg,
    oldest_session_age_ms: oldest,
  };
}

export function checkRateLimit(sessionKey: string): { allowed: boolean; retryAfter?: number } {
  if (!isMultiTenantEnabled()) return { allowed: true };
  if (!isRateLimitingEnabled()) return { allowed: true };
  const ctx = connections.get(sessionKey);
  if (!ctx || !ctx.rateLimiter) return { allowed: true };
  if (ctx.rateLimiter.consume()) return { allowed: true };
  const ra = ctx.rateLimiter.getRetryAfter();
  return { allowed: false, retryAfter: ra };
}

function shouldVerifyScope(): boolean {
  return process.env.VERIFY_TOKEN_SCOPE === 'true';
}

export async function verifyTokenScopeForSession(sessionKey: string): Promise<void> {
  const ctx = connections.get(sessionKey);
  if (!ctx) throw new Error('No session found');
  if (!shouldVerifyScope()) return;
  if (ctx.scopeVerified) return;
  if (ctx.scopeVerifyPromise) return ctx.scopeVerifyPromise;

  const API_VERSION = normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);
  const cred = ctx.credentials;
  const headers = buildAdsHeaders({
    accessToken: cred.access_token,
    developerToken: cred.developer_token,
    quotaProjectId: cred.quota_project_id,
  });

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;
  ctx.scopeVerifyPromise = fetch(url, { method: 'GET', headers })
    .then(async (res) => {
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('ERR_INSUFFICIENT_SCOPE: Access token missing adwords scope');
        }
        const t = await res.text();
        throw new Error(`Scope verification failed: HTTP ${res.status} ${t || ''}`);
      }
      ctx.scopeVerified = true;
      ctx.scopeVerifyPromise = undefined;
    })
    .catch((e) => {
      ctx.scopeVerifyPromise = undefined;
      throw e;
    });

  return ctx.scopeVerifyPromise;
}
