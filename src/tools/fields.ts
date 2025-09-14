import { buildAdsHeaders } from '../headers.js';
import { getAccessToken } from '../auth.js';
import { normalizeApiVersion } from '../utils/normalizeApiVersion.js';

const API_VERSION = normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);

export type FieldSearchResponse = {
  ok: boolean;
  status: number;
  data?: any;
  errorText?: string;
};

export async function searchGoogleAdsFields(query: string, sessionKey?: string): Promise<FieldSearchResponse> {
  const { token, quotaProjectId, developerToken: devFromToken } = await getAccessToken(sessionKey);
  const developerToken = devFromToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const headers = buildAdsHeaders({ accessToken: token, developerToken, quotaProjectId });
  const url = `https://googleads.googleapis.com/${API_VERSION}/googleAdsFields:search`;
  const init: RequestInit = { method: 'POST', headers, body: JSON.stringify({ query }) };
  const res = await fetch(url, init);
  if (res.ok) {
    const data = await res.json();
    return { ok: true, status: res.status, data };
  }
  const errorText = await res.text();
  return { ok: false, status: res.status, errorText };
}
