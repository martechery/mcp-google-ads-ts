import { getAccessToken } from '../auth.js';
import { buildAdsHeaders } from '../headers.js';

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v19';

export type AccountsResponse = {
  ok: boolean;
  status: number;
  data?: { resourceNames?: string[] };
  errorText?: string;
};

export async function listAccessibleCustomers(): Promise<AccountsResponse> {
  const { token, quotaProjectId } = await getAccessToken();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const headers = buildAdsHeaders({ accessToken: token, developerToken, quotaProjectId });

  const url = `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`;
  const init: RequestInit = { method: 'GET', headers };
  const res = await fetch(url, init);
  if (res.ok) {
    const data = await res.json();
    return { ok: true, status: res.status, data };
  }
  const errorText = await res.text();
  return { ok: false, status: res.status, errorText };
}
