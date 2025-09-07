type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval?: number;
};

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  token_type: string;
};

const ADS_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/adwords',
];

export async function runDeviceOAuthForAds(opts: { clientId: string; clientSecret: string }): Promise<{ path: string }>
{
  const { clientId, clientSecret } = opts;
  const device = await startDeviceFlow(clientId);
  const lines = [
    'To authorize, open the URL and enter the code:',
    `  ${device.verification_url}`,
    `  Code: ${device.user_code}`,
  ];
  // Emit to console for local runs; MCP clients will capture tool text output
  try { console.log(lines.join('\n')); } catch { /* ignore */ }
  const token = await pollForToken({ clientId, clientSecret, device, timeoutMs: (device.expires_in - 5) * 1000, intervalMs: (device.interval ?? 5) * 1000 });
  const refresh = token.refresh_token;
  if (!refresh) throw new Error('No refresh_token returned by device flow. Ensure the OAuth client is Desktop app and consent granted.');
  const path = await saveAuthorizedUserJson({ clientId, clientSecret, refreshToken: refresh });
  // Set for current process to enable immediate use
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  return { path };
}

async function startDeviceFlow(clientId: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope: ADS_SCOPES.join(' ') });
  const res = await fetch('https://oauth2.googleapis.com/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Device code request failed: HTTP ${res.status}`);
  return await res.json() as DeviceCodeResponse;
}

async function pollForToken(params: { clientId: string; clientSecret: string; device: DeviceCodeResponse; timeoutMs: number; intervalMs: number }): Promise<TokenResponse> {
  const { clientId, clientSecret, device, timeoutMs, intervalMs } = params;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      device_code: device.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.ok) {
      return await res.json() as TokenResponse;
    }
    // Authorization_pending / slow_down should continue polling
    await sleep(intervalMs);
  }
  throw new Error('Timed out waiting for device authorization.');
}

async function saveAuthorizedUserJson(opts: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
  const fs = await import('node:fs');
  const pathMod = await import('node:path');
  const dir = pathMod.resolve(process.cwd(), '.auth');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
  const file = pathMod.join(dir, 'adc.json');
  const content = {
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
    type: 'authorized_user',
  };
  fs.writeFileSync(file, JSON.stringify(content, null, 2), { mode: 0o600 });
  return file;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
