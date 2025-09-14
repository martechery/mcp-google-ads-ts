import { ConnectionContext, GoogleCredential } from '../types/connection.js';
import { validateSessionKey } from './session-validator.js';

const connections = new Map<string, ConnectionContext>();
let sweeperInterval: NodeJS.Timeout | null = null;

function isMultiTenantEnabled(): boolean {
  return process.env.ENABLE_RUNTIME_CREDENTIALS === 'true';
}

export function establishSession(sessionKey: string, credentials: GoogleCredential): { session_key: string; expires_in: number } {
  if (!isMultiTenantEnabled()) {
    throw new Error('Multi-tenant mode not enabled');
  }
  validateSessionKey(sessionKey);
  if (!credentials.developer_token) {
    throw new Error('Developer token required in multi-tenant mode');
  }

  const allowedIds = process.env.ALLOWED_CUSTOMER_IDS
    ? new Set(process.env.ALLOWED_CUSTOMER_IDS.split(',').map((s) => s.trim()).filter(Boolean))
    : undefined;

  const now = Date.now();
  connections.set(sessionKey, {
    session_key: sessionKey,
    credentials,
    establishedAt: now,
    lastActivityAt: now,
    allowedCustomerIds: allowedIds,
  });
  startConnectionSweeper();

  const ttlSec = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600', 10);
  return { session_key: sessionKey, expires_in: ttlSec };
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
}

export function startConnectionSweeper(): void {
  if (sweeperInterval) return;
  sweeperInterval = setInterval(() => {
    const now = Date.now();
    const ttlMs = parseInt(process.env.RUNTIME_CREDENTIAL_TTL || '3600', 10) * 1000;
    for (const [key, ctx] of connections.entries()) {
      if (now - ctx.lastActivityAt > ttlMs) {
        connections.delete(key);
      }
    }

    const max = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);
    if (connections.size > max) {
      const sorted = Array.from(connections.entries()).sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt);
      for (let i = 0; i < sorted.length - max; i++) {
        connections.delete(sorted[i][0]);
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

