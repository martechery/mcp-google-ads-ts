/// <reference types="node" />
// Load environment variables from .env before tests
import 'dotenv/config';

// Force integration tests to use ADC (ignore any dev/test env token)
try {
  // eslint-disable-next-line no-console
  if (process.env.GOOGLE_ADS_ACCESS_TOKEN) console.log('[integration] Ignoring GOOGLE_ADS_ACCESS_TOKEN for live tests');
  delete (process.env as any).GOOGLE_ADS_ACCESS_TOKEN;
} catch {
  // ignore
}
