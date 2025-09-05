/*
  Real-world smoke test using ADC and developer token.
  Usage:
    export GOOGLE_ADS_DEVELOPER_TOKEN=...
    gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords
    pnpm run smoke
    SMOKE_CUSTOMER_ID=1234567890 pnpm run smoke
*/
import 'dotenv/config';
import { listAccessibleCustomers } from '../src/tools/accounts.js';
import { buildPerformanceQuery } from '../src/tools/performance.js';
import { executeGaql } from '../src/tools/gaql.js';

async function main() {
  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    console.error('Missing GOOGLE_ADS_DEVELOPER_TOKEN');
    process.exit(1);
  }

  console.log('Listing accessible accounts...');
  const accounts = await listAccessibleCustomers();
  if (!accounts.ok) {
    console.error('Error listing accounts:', accounts.errorText || accounts.status);
    process.exit(2);
  }
  const names = accounts.data?.resourceNames || [];
  console.log('Accounts:', names.slice(0, 5));

  const cid = process.env.SMOKE_CUSTOMER_ID;
  if (cid) {
    console.log(`\nFetching sample performance for customer ${cid} (campaign, last 7 days)...`);
    const query = buildPerformanceQuery('campaign', 7, 5);
    const res = await executeGaql({ customerId: cid, query });
    if (!res.ok) {
      console.error('Performance query failed:', res.status, res.errorText);
      process.exit(3);
    }
    console.log('Results sample:', JSON.stringify(res.data?.results?.slice(0, 3) || [], null, 2));
  }
}

main().catch((err) => {
  console.error('Smoke test error:', err);
  process.exit(10);
});
