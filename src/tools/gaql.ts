import { buildAdsHeaders } from '../headers.js';
import { getAccessToken } from '../auth.js';
import { formatCustomerId } from '../utils/formatCustomerId.js';

const API_VERSION = 'v19';

export type ExecuteGaqlParams = {
  customerId: string;
  query: string;
};

export type GaqlResponse = {
  ok: boolean;
  status: number;
  data?: any;
  errorText?: string;
};

export async function executeGaql({ customerId, query }: ExecuteGaqlParams): Promise<GaqlResponse> {
  const { token, quotaProjectId } = await getAccessToken();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  const headers = buildAdsHeaders({
    accessToken: token,
    developerToken,
    loginCustomerId,
    quotaProjectId,
  });

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${formatCustomerId(customerId)}/googleAds:search`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  } as any);

  const contentType = (res.headers as any)?.get?.('content-type') || '';
  if (res.ok) {
    const data = contentType.includes('application/json') ? await res.json() : await res.text();
    return { ok: true, status: res.status, data };
  }
  const errorText = await res.text();
  return { ok: false, status: res.status, errorText };
}
