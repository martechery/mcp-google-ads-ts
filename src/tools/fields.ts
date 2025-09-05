import { buildAdsHeaders } from '../headers.js';
import { getAccessToken } from '../auth.js';

const API_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v19';

export type FieldSearchResponse = {
  ok: boolean;
  status: number;
  data?: any;
  errorText?: string;
};

export async function searchGoogleAdsFields(query: string): Promise<FieldSearchResponse> {
  const { token, quotaProjectId } = await getAccessToken();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const headers = buildAdsHeaders({ accessToken: token, developerToken, quotaProjectId });
  const url = `https://googleads.googleapis.com/${API_VERSION}/googleAdsFields:search`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query }) } as any);
  if (res.ok) {
    const data = await res.json();
    return { ok: true, status: res.status, data };
  }
  const errorText = await res.text();
  return { ok: false, status: res.status, errorText };
}
