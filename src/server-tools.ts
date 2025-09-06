import { Server } from '@modelcontextprotocol/sdk/server';
import { executeGaql } from './tools/gaql.js';
import { listAccessibleCustomers } from './tools/accounts.js';
import { buildPerformanceQuery } from './tools/performance.js';
import { tabulate } from './utils/formatTable.js';
import { searchGoogleAdsFields } from './tools/fields.js';
import { gaqlHelp } from './tools/gaqlHelp.js';
import { mapAdsErrorMsg } from './utils/errorMapping.js';
import { microsToUnits } from './utils/currency.js';
import { ManageAuthSchema, ListResourcesSchema, ExecuteGaqlSchema, GetPerformanceSchema, GaqlHelpSchema } from './schemas.js';

export function registerTools(server: Server) {
  // Removed: ping and get_auth_status (status merged into manage_auth)

  // Manage auth tool (status implemented)
  server.tool(
    {
      name: "manage_auth",
      description:
        "Manage Google Ads auth: status (implemented), switch/refresh (behind allow_subprocess flag).",
      input_schema: ManageAuthSchema as any,
    },
    async (input: any) => {
      const action = (input?.action || 'status').toLowerCase();
      const allowSub = !!input?.allow_subprocess;

      if (action === 'status') {
        const authType = process.env.GOOGLE_ADS_AUTH_TYPE || "(not set)";
        const useCli = process.env.GOOGLE_ADS_GCLOUD_USE_CLI || "false";
        const credsPath = process.env.GOOGLE_ADS_CREDENTIALS_PATH || "(not set)";
        const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID || "(not set)";
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "(not set)";
        const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "(not set)";

        const lines: string[] = [
          'Google Ads Auth Status',
          '=======================',
          'Environment:',
          `  GOOGLE_ADS_AUTH_TYPE: ${authType}`,
          `  GOOGLE_ADS_GCLOUD_USE_CLI: ${useCli}`,
          `  GOOGLE_ADS_CREDENTIALS_PATH: ${credsPath}`,
          `  GOOGLE_ADS_CUSTOMER_ID: ${customerId}`,
          `  GOOGLE_ADS_LOGIN_CUSTOMER_ID: ${loginCustomerId}`,
          `  GOOGLE_ADS_DEVELOPER_TOKEN: ${developerToken ? "(set)" : "(not set)"}`,
          'Notes:',
          "- For 'gcloud/adc' mode, credentials path is not required.",
          '- Prefer ADC over CLI fallback for stability and auto-refresh.',
          '- oauth and service_account modes remain available for compatibility.',
          '',
          'Probes:',
        ];
        try {
          const { token, quotaProjectId, type } = await (await import('./auth.js')).getAccessToken();
          lines.push(`  Auth type: ${type}`);
          lines.push(`  Token present: ${token ? 'yes' : 'no'}`);
          lines.push(`  Quota project: ${quotaProjectId || '(none)'}`);
          // Probe scope by hitting listAccessibleCustomers
          const resp = await listAccessibleCustomers();
          if (resp.ok) {
            lines.push('  Ads scope check: OK');
            const count = resp.data?.resourceNames?.length || 0;
            lines.push(`  Accessible accounts: ${count}`);
          } else if (resp.status === 403 && (resp.errorText || '').includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            lines.push('  Ads scope check: missing scope (ACCESS_TOKEN_SCOPE_INSUFFICIENT)');
          } else {
            lines.push(`  Ads scope check: HTTP ${resp.status}`);
          }
        } catch (e: any) {
          lines.push(`  Error determining auth status: ${e?.message || String(e)}`);
        }
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      if (action === 'switch') {
        const name = input?.config_name?.trim();
        if (!name) {
          return { content: [{ type: 'text', text: "Missing 'config_name'. Example: { action: 'switch', config_name: 'my-config' }" }] };
        }
        const cmd = `gcloud config configurations activate ${name}`;
        if (!allowSub) {
          const text = [
            'Planned action: switch gcloud configuration',
            `Command: ${cmd}`,
            'Tip: Re-run with allow_subprocess=true to execute from MCP.',
          ].join('\n');
          return { content: [{ type: 'text', text }] };
        }
        const { execCmd } = await import('./utils/exec.js');
        const { code, stdout, stderr } = await execCmd('gcloud', ['config', 'configurations', 'activate', name]);
        const lines = [
          `gcloud switch (${name}) exit: ${code}`,
          stdout ? `stdout:\n${stdout}` : '',
          stderr ? `stderr:\n${stderr}` : '',
          'Next: refresh ADC credentials to ensure Ads scope:',
          '  gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords',
        ].filter(Boolean);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      if (action === 'refresh') {
        const loginCmd = 'gcloud auth application-default login --scopes=https://www.googleapis.com/auth/adwords';
        if (!allowSub) {
          const text = [
            'Planned action: refresh ADC credentials for Ads scope',
            `Command: ${loginCmd}`,
            'Tip: Re-run with allow_subprocess=true to execute from MCP.',
          ].join('\n');
          return { content: [{ type: 'text', text }] };
        }
        const { execCmd } = await import('./utils/exec.js');
        const step1 = await execCmd('gcloud', ['auth', 'application-default', 'login', '--scopes=https://www.googleapis.com/auth/adwords']);
        // Verify by printing a token (will also surface scope issues)
        const step2 = await execCmd('gcloud', ['auth', 'application-default', 'print-access-token']);
        let check: any;
        try {
          const mod = await import('./tools/accounts.js');
          const fn = (mod as any).listAccessibleCustomers || listAccessibleCustomers;
          check = await fn();
        } catch { check = undefined; }
        const lines = [
          `refresh login exit: ${step1.code}`,
          step1.stdout ? `login stdout:\n${step1.stdout}` : '',
          step1.stderr ? `login stderr:\n${step1.stderr}` : '',
          `print-token exit: ${step2.code}`,
          step2.stdout ? `token (truncated): ${step2.stdout.slice(0, 12)}...` : '',
          step2.stderr ? `print-token stderr:\n${step2.stderr}` : '',
          (check && check.ok)
            ? 'Ads scope check after refresh: OK'
            : (step2.code === 0 ? 'Ads scope check after refresh: OK (token printed)' : `Ads scope check after refresh: ${check ? `HTTP ${check.status}` : 'unknown'}`),
        ].filter(Boolean);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      return { content: [{ type: 'text', text: `Unknown action '${action}'. Use status | switch | refresh.` }] };
    }
  );

  // Execute GAQL query tool (basic)
  server.tool(
    {
      name: "execute_gaql_query",
      description: "Execute GAQL against Ads API v19. Hints: page_size/page_token for manual paging, or auto_paginate+max_pages. output_format=table|json|csv.",
      input_schema: ExecuteGaqlSchema as any,
    },
    async (input: any) => {
      const auto = !!input.auto_paginate;
      const maxPages = Math.max(1, Math.min(20, Number(input.max_pages ?? 5)));
      const pageSize = (typeof input.page_size === 'number') ? Math.max(1, Math.min(10_000, Number(input.page_size))) : undefined;
      let pageToken = input.page_token as string | undefined;
      let all: any[] = [];
      let lastToken: string | undefined;
      let pageCount = 0;
      do {
        const res = await executeGaql({ customerId: input.customer_id, query: input.query, pageSize, pageToken });
        if (!res.ok) {
          const hint = mapAdsErrorMsg(res.status, res.errorText || '');
          const lines = [`Error executing query (status ${res.status}): ${res.errorText || ''}`];
          if (hint) lines.push(`Hint: ${hint}`);
          return { content: [{ type: "text", text: lines.join('\n') }] };
        }
        const data = res.data;
        const results = (data?.results && Array.isArray(data.results)) ? data.results : [];
        all = all.concat(results);
        lastToken = data?.nextPageToken;
        pageToken = auto ? lastToken : undefined;
        pageCount++;
      } while (auto && pageToken && pageCount < maxPages);

      if (!all.length) {
        return { content: [{ type: "text", text: "No results found for the query." }] };
      }
      const first = all[0];
      const fields: string[] = [];
      for (const key of Object.keys(first)) {
        const val = (first as any)[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const sub of Object.keys(val)) fields.push(`${key}.${sub}`);
        } else {
          fields.push(key);
        }
      }
      const fmt = (input.output_format || 'table').toLowerCase();
      if (fmt === 'json') return { content: [{ type: 'text', text: JSON.stringify(all, null, 2) }] };
      if (fmt === 'csv') {
        const { toCsv } = await import('./utils/formatCsv.js');
        const csv = toCsv(all, fields);
        return { content: [{ type: 'text', text: csv }] };
      }
      const table = tabulate(all, fields);
      const lines: string[] = ["Query Results:", table];
      if (!auto && lastToken) lines.push(`Next Page Token: ${lastToken}`);
      if (auto) lines.push(`Pages fetched: ${pageCount}`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // List accessible accounts: removed for simplicity. Use list_resources(kind=accounts).

  // Unified performance tool
  server.tool(
    {
      name: "get_performance",
      description: "Get performance at campaign|ad_group|ad with currency. Supports filters, pagination (page_size/page_token), auto_paginate/max_pages, and output_format=table|json|csv.",
      input_schema: GetPerformanceSchema as any,
    },
    async (input: any) => {
      const days = Math.max(1, Math.min(365, Number(input.days ?? 30)));
      const limit = Math.max(1, Math.min(1000, Number(input.limit ?? 50)));
      const query = buildPerformanceQuery(input.level, days, limit, input.filters || {});
      const auto = !!input.auto_paginate;
      const maxPages = Math.max(1, Math.min(20, Number(input.max_pages ?? 5)));
      const pageSize = (typeof input.page_size === 'number') ? Math.max(1, Math.min(10_000, Number(input.page_size))) : undefined;
      let pageToken = input.page_token as string | undefined;
      let all: any[] = [];
      let lastToken: string | undefined;
      let pageCount = 0;
      do {
        const res = await executeGaql({ customerId: input.customer_id, query, pageSize, pageToken });
        if (!res.ok) {
          const hint = mapAdsErrorMsg(res.status, res.errorText || '');
          const lines = [`Error executing performance query (status ${res.status}): ${res.errorText || ''}`];
          if (hint) lines.push(`Hint: ${hint}`);
          return { content: [{ type: "text", text: lines.join('\n') }] };
        }
        const data = res.data;
        const results = (data?.results && Array.isArray(data.results)) ? data.results : [];
        all = all.concat(results);
        lastToken = data?.nextPageToken;
        pageToken = auto ? lastToken : undefined;
        pageCount++;
      } while (auto && pageToken && pageCount < maxPages);

      if (!all.length) {
        return { content: [{ type: "text", text: "No results found for the selected period." }] };
      }
      const rows = (all as any[]).map((r: any) => {
        const out = { ...r };
        const metrics = { ...(r?.metrics || {}) } as any;
        const micros = (metrics.cost_micros ?? metrics.costMicros);
        if (typeof micros === 'number') metrics.cost_units = microsToUnits(micros);
        (out as any).metrics = metrics;
        return out;
      });
      const first = rows[0];
      const fields: string[] = [];
      for (const key of Object.keys(first)) {
        const val = (first as any)[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const sub of Object.keys(val)) fields.push(`${key}.${sub}`);
        } else {
          fields.push(key);
        }
      }
      const fmt = (input.output_format || 'table').toLowerCase();
      if (fmt === 'json') return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      if (fmt === 'csv') {
        const { toCsv } = await import('./utils/formatCsv.js');
        const csv = toCsv(rows, fields);
        return { content: [{ type: 'text', text: csv }] };
      }
      const table = tabulate(rows, fields);
      const lines: string[] = [
        `Performance (${input.level}) for last ${input.days ?? 30} days:`,
        table,
      ];
      if (!auto && lastToken) lines.push(`Next Page Token: ${lastToken}`);
      if (auto) lines.push(`Pages fetched: ${pageCount}`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // List GAQL FROM resources (via google_ads_field metadata) or accounts
  server.tool(
    {
      name: "list_resources",
      description: "List GAQL FROM-able resources via google_ads_field (category=RESOURCE, selectable=true) or list accounts. output_format=table|json|csv.",
      input_schema: ListResourcesSchema as any,
    },
    async (input: any) => {
      const kind = String(input?.kind || 'resources').toLowerCase();
      if (kind === 'accounts') {
        const res = await listAccessibleCustomers();
        if (!res.ok) {
          const hint = mapAdsErrorMsg(res.status, res.errorText || '');
          const lines = [`Error listing accounts (status ${res.status}): ${res.errorText || ''}`];
          if (hint) lines.push(`Hint: ${hint}`);
          return { content: [{ type: 'text', text: lines.join('\n') }] };
        }
        const names = res.data?.resourceNames || [];
        const rows = names.map((rn: string) => ({ account_id: (rn.split('/').pop() || rn) }));
        const fields = ['account_id'];
        const fmt = (input.output_format || 'table').toLowerCase();
        if (fmt === 'json') return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
        if (fmt === 'csv') {
          const { toCsv } = await import('./utils/formatCsv.js');
          const csv = toCsv(rows, fields);
          return { content: [{ type: 'text', text: csv }] };
        }
        const table = tabulate(rows, fields);
        return { content: [{ type: 'text', text: `Accounts:\n${table}` }] };
      }
      const limit = Math.max(1, Math.min(1000, Number(input?.limit ?? 500)));
      const filter = (input?.filter || '').trim();
      const where = ["category = 'RESOURCE'", 'selectable = true'];
      if (filter) where.push(`name LIKE '%${filter.replace(/'/g, "''")}%'`);
      const query = `SELECT name, category, selectable FROM google_ads_field WHERE ${where.join(' AND ')} ORDER BY name LIMIT ${limit}`;
      const res = await searchGoogleAdsFields(query);
      if (!res.ok) {
        const hint = mapAdsErrorMsg(res.status, res.errorText || '');
        const lines = [`Error listing resources (status ${res.status}): ${res.errorText || ''}`];
        if (hint) lines.push(`Hint: ${hint}`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
      const items = (res.data?.results || []).map((r: any) => ({ name: r.googleAdsField?.name, category: r.googleAdsField?.category, selectable: r.googleAdsField?.selectable }));
      if (!items.length) return { content: [{ type: 'text', text: 'No resources found.' }] };
      const fields = ['name', 'category', 'selectable'];
      const fmt = (input.output_format || 'table').toLowerCase();
      if (fmt === 'json') return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] };
      if (fmt === 'csv') {
        const { toCsv } = await import('./utils/formatCsv.js');
        const csv = toCsv(items, fields);
        return { content: [{ type: 'text', text: csv }] };
      }
      const table = tabulate(items, fields);
      return { content: [{ type: 'text', text: `GAQL Resources:\n${table}` }] };
    }
  );

  // GAQL help: fetches and summarizes Google docs based on a question
  server.tool(
    {
      name: "gaql_help",
      description: "Targeted GAQL guidance from Google docs. Hints: set quick_tips=true for offline cheat-sheet; topics=[overview,grammar,structure,date_ranges,case_sensitivity,ordering,cookbook].",
      input_schema: GaqlHelpSchema as any,
    },
    async (input: any) => {
      try {
        const text = await gaqlHelp({
          question: input?.question,
          topics: Array.isArray(input?.topics) ? input.topics : undefined,
          quick_tips: !!input?.quick_tips,
          include_examples: !!input?.include_examples,
          max_chars: input?.max_chars,
        });
        return { content: [{ type: 'text', text }] };
      } catch (e: any) {
        const lines = [
          `Error fetching GAQL help: ${e?.message || String(e)}`,
          'Hint: set quick_tips=true to avoid network usage.',
        ];
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
    }
  );
}
