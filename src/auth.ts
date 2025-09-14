// Lightweight auth abstraction to enable unit testing and future ADC integration.
// For now, prefer reading an explicit token from env for tests/dev.

export type AuthType = 'env' | 'adc' | 'gcloud_cli' | 'oauth' | 'service_account' | 'runtime';

export type AccessToken = {
  token: string;
  type: AuthType;
  quotaProjectId?: string;
  developerToken?: string;
};

import { getConnection, touchConnection, refreshAccessTokenForSession } from './utils/connection-manager.js';

export async function getAccessToken(sessionKey?: string): Promise<AccessToken> {
  if (process.env.ENABLE_RUNTIME_CREDENTIALS === 'true') {
    if (!sessionKey) {
      throw new Error('ERR_NO_SESSION_KEY: session_key required in multi-tenant mode');
    }
    const ctx = getConnection(sessionKey);
    if (!ctx) {
      throw new Error('ERR_NO_CREDENTIALS: No credentials provided for this session');
    }
    touchConnection(sessionKey);
    const cred = ctx.credentials;
    // Preemptive refresh if expiring within 5 minutes
    const now = Date.now();
    const expiresAt = cred.expires_at ?? 0;
    const needsRefresh = !!cred.refresh_token && expiresAt > 0 && expiresAt - now < 5 * 60 * 1000;
    if (needsRefresh) {
      try {
        await refreshAccessTokenForSession(sessionKey);
      } catch (e) {
        // If refresh fails, fall through to use existing token or surface error
        // Connection manager will purge session on invalid_grant
      }
    }
    return {
      token: (getConnection(sessionKey)?.credentials.access_token) || cred.access_token,
      type: 'runtime',
      quotaProjectId: cred.quota_project_id,
      developerToken: cred.developer_token,
    };
  }
  const envToken = process.env.GOOGLE_ADS_ACCESS_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      type: 'env',
      quotaProjectId: process.env.GOOGLE_ADS_QUOTA_PROJECT_ID || undefined,
    };
  }

  // Fallbacks: if GOOGLE_APPLICATION_CREDENTIALS is not set, check for local ADC file and well-known path
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const os = await import('node:os');
      const localPath = path.resolve(process.cwd(), '.auth', 'adc.json');
      const exists = (p?: string) => !!p && fs.existsSync(p);
      let wellKnown: string | undefined;
      if (process.platform === 'win32') {
        const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        wellKnown = path.join(appData, 'gcloud', 'application_default_credentials.json');
      } else {
        wellKnown = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
      }
      if (exists(localPath)) process.env.GOOGLE_APPLICATION_CREDENTIALS = localPath;
      else if (exists(wellKnown)) process.env.GOOGLE_APPLICATION_CREDENTIALS = wellKnown;
    } catch {
      // ignore fs errors
    }
  }
  // Attempt Application Default Credentials via google-auth-library
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/adwords'],
  });
  try {
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const quotaProjectId = (auth as any).quotaProjectId || process.env.GOOGLE_ADS_QUOTA_PROJECT_ID || undefined;
    if (!token || !token.token) {
      const hasClientCreds = !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      if (hasClientCreds) {
        throw new Error(
          'ADC not configured. GOOGLE_OAUTH_CLIENT_ID/SECRET present. Hint: run manage_auth with { "action": "oauth_login" } to complete OAuth and create an ADC file.'
        );
      }
      throw new Error('ADC returned no access token. Run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/adwords');
    }
    return { token: token.token, type: 'adc', quotaProjectId };
  } catch (e: any) {
    const hasClientCreds = !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (hasClientCreds) {
      throw new Error(
        'ADC not configured. GOOGLE_OAUTH_CLIENT_ID/SECRET present. Hint: run manage_auth with { "action": "oauth_login" } to complete OAuth and create an ADC file.'
      );
    }
    throw e;
  }
}
