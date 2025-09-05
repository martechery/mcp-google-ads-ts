import { formatCustomerId } from './utils/formatCustomerId.js';

export type BuildHeadersInput = {
  accessToken: string;
  developerToken: string;
  loginCustomerId?: string;
  quotaProjectId?: string;
};

export function buildAdsHeaders(input: BuildHeadersInput): Record<string, string> {
  const { accessToken, developerToken, loginCustomerId, quotaProjectId } = input;
  if (!accessToken) throw new Error('Missing access token');
  if (!developerToken) throw new Error('Missing developer token');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': developerToken,
    'content-type': 'application/json',
  };

  if (quotaProjectId) {
    headers['x-goog-user-project'] = quotaProjectId;
  }

  if (loginCustomerId) {
    headers['login-customer-id'] = formatCustomerId(loginCustomerId);
  }

  return headers;
}

