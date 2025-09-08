#!/usr/bin/env tsx
import 'dotenv/config';

import { getAccessToken } from '../src/auth.js';
import { buildAdsHeaders } from '../src/headers.js';
import { formatCustomerId } from '../src/utils/formatCustomerId.js';
import { normalizeApiVersion } from '../src/utils/normalizeApiVersion.js';

async function tokenInfo(token: string) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return { ok: false, status: 0, body: String(e) };
  }
}

async function listAccounts() {
  const { token, quotaProjectId } = await getAccessToken();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const apiVersion = normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);
  const headers = buildAdsHeaders({ accessToken: token, developerToken, quotaProjectId });
  const url = `https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`;
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function runGaql(customerId: string, query: string) {
  const { token, quotaProjectId } = await getAccessToken();
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
  const apiVersion = normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);
  const loginCustomerId = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const headers = buildAdsHeaders({ accessToken: token, developerToken, quotaProjectId, loginCustomerId });
  const url = `https://googleads.googleapis.com/${apiVersion}/customers/${formatCustomerId(customerId)}/googleAds:search`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query, pageSize: 1 }) });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function main() {
  const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const mcc = process.env.GOOGLE_ADS_MANAGER_ACCOUNT_ID;
  const cid = process.env.GOOGLE_ADS_ACCOUNT_ID;
  if (!devToken) {
    console.error('Missing GOOGLE_ADS_DEVELOPER_TOKEN');
    process.exit(2);
  }
  console.log('Env summary:');
  console.log('  GOOGLE_ADS_MANAGER_ACCOUNT_ID:', mcc || '(not set)');
  console.log('  GOOGLE_ADS_ACCOUNT_ID:', cid || '(not set)');

  const { token } = await getAccessToken();
  const info = await tokenInfo(token);
  console.log('Token info:', info.status, info.ok ? info.body : '(error) ' + info.body);

  console.log('\nCalling listAccessibleCustomers...');
  const acc = await listAccounts();
  console.log('listAccessibleCustomers:', acc.status);
  console.log(acc.text.slice(0, 500));

  if (cid) {
    console.log(`\nRunning GAQL on ${cid} (customer snapshot)...`);
    const out = await runGaql(cid, 'SELECT customer.id, customer.currency_code FROM customer LIMIT 1');
    console.log('gaql status:', out.status);
    console.log(out.text.slice(0, 800));
  }
}

main().catch((e) => { console.error('Error:', e); process.exit(1); });

