// Lightweight auth abstraction to enable unit testing and future ADC integration.
// For now, prefer reading an explicit token from env for tests/dev.

export type AuthType = 'env' | 'adc' | 'gcloud_cli' | 'oauth' | 'service_account';

export type AccessToken = {
  token: string;
  type: AuthType;
  quotaProjectId?: string;
};

export async function getAccessToken(): Promise<AccessToken> {
  const envToken = process.env.GOOGLE_ADS_ACCESS_TOKEN;
  if (envToken) {
    return {
      token: envToken,
      type: 'env',
      quotaProjectId: process.env.GOOGLE_ADS_QUOTA_PROJECT_ID || undefined,
    };
  }

  const authType = (process.env.GOOGLE_ADS_AUTH_TYPE || 'adc').toLowerCase();
  if (authType === 'adc' || authType === 'gcloud') {
    // Attempt Application Default Credentials via google-auth-library
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/adwords'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const quotaProjectId = (auth as any).quotaProjectId || process.env.GOOGLE_ADS_QUOTA_PROJECT_ID || undefined;
    if (!token || !token.token) {
      throw new Error('ADC returned no access token. Run: gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords');
    }
    return { token: token.token, type: 'adc', quotaProjectId };
  }

  throw new Error('Only env or ADC auth supported currently. Set GOOGLE_ADS_ACCESS_TOKEN or GOOGLE_ADS_AUTH_TYPE=adc');
}
