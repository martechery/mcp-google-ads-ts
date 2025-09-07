import { describe, it, expect } from 'vitest';
import { buildAdsHeaders } from '../../src/headers.js';

describe('buildAdsHeaders', () => {
  it('builds required headers', () => {
    const headers = buildAdsHeaders({
      accessToken: 'abc',
      developerToken: 'dev123',
    });
    expect(headers.Authorization).toBe('Bearer abc');
    expect(headers['developer-token']).toBe('dev123');
    expect(headers['content-type']).toBe('application/json');
  });

  it('formats login-customer-id and sets x-goog-user-project', () => {
    const headers = buildAdsHeaders({
      accessToken: 't',
      developerToken: 'd',
      loginCustomerId: '123-456-7890',
      quotaProjectId: 'my-project',
    });
    expect(headers['login-customer-id']).toBe('1234567890');
    expect(headers['x-goog-user-project']).toBe('my-project');
  });
});
