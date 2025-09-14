import { buildAdsHeaders } from '../headers.js';
import { getAccessToken } from '../auth.js';
import { formatCustomerId } from '../utils/formatCustomerId.js';
import { normalizeApiVersion } from '../utils/normalizeApiVersion.js';

const API_VERSION = normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);

export type ExecuteGaqlParams = {
  customerId: string;
  query: string;
  pageSize?: number;
  pageToken?: string;
  // Optional per-call login-customer override (MCC/manager account id)
  loginCustomerId?: string | number;
  sessionKey?: string;
};

export type GaqlResponse = {
  ok: boolean;
  status: number;
  data?: any;
  errorText?: string;
};

export async function executeGaql({ customerId, query, pageSize, pageToken, loginCustomerId, sessionKey }: ExecuteGaqlParams): Promise<GaqlResponse> {
  const { token, quotaProjectId, developerToken: devFromToken } = await getAccessToken(sessionKey);
  const developerToken = devFromToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const loginCustomerHeader = (loginCustomerId != null ? String(loginCustomerId) : process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID);

  const headers = buildAdsHeaders({
    accessToken: token,
    developerToken,
    loginCustomerId: loginCustomerHeader,
    quotaProjectId,
  });

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${formatCustomerId(customerId)}/googleAds:search`;
  const body: any = { query };
  if (typeof pageSize === 'number' && pageSize > 0) body.pageSize = pageSize;
  if (pageToken) body.pageToken = pageToken;

  const init: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  };
  const res = await fetch(url, init);

  const contentType = res.headers?.get?.('content-type') || '';
  if (res.ok) {
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { ok: true, status: res.status, data };
  }
  const errorText = await res.text();
  return { ok: false, status: res.status, errorText };
}
