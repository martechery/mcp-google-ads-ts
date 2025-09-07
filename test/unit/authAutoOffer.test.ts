import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('auth auto-offer oauth_login', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.GOOGLE_ADS_ACCESS_TOKEN;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'secret';
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('throws actionable hint when ADC missing and OAuth client env present', async () => {
    vi.mock('google-auth-library', () => ({
      GoogleAuth: class {
        quotaProjectId = undefined;
        getClient() { return { getAccessToken: async () => ({ token: null }) }; }
      },
    }));
    const mod = await import('../../src/auth.js');
    await expect(mod.getAccessToken()).rejects.toThrow(/oauth_login/);
  });
});
