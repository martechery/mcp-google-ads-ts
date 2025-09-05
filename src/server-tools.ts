import { Server } from '@modelcontextprotocol/sdk/server';
import { executeGaql } from './tools/gaql.js';
import { listAccessibleCustomers } from './tools/accounts.js';
import { formatCustomerId } from './utils/formatCustomerId.js';
import { buildPerformanceQuery } from './tools/performance.js';
import { tabulate } from './utils/formatTable.js';

export function registerTools(server: Server) {
  // Health check tool
  server.tool(
    {
      name: "ping",
      description: "Health check; returns 'pong'",
      input_schema: { type: "object", additionalProperties: false, properties: {} },
    },
    async () => ({ content: [{ type: 'text', text: 'pong' }] })
  );

  // Inspect current auth env configuration
  server.tool(
    {
      name: "get_auth_status",
      description:
        "Summarize Google Ads auth configuration based on environment variables (ADC/gcloud, oauth, service_account).",
      input_schema: { type: "object", additionalProperties: false, properties: {} },
    },
    async () => {
      const authType = process.env.GOOGLE_ADS_AUTH_TYPE || "(not set)";
      const useCli = process.env.GOOGLE_ADS_GCLOUD_USE_CLI || "false";
      const credsPath = process.env.GOOGLE_ADS_CREDENTIALS_PATH || "(not set)";
      const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID || "(not set)";
      const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "(not set)";
      const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "(not set)";

      const lines = [
        `GOOGLE_ADS_AUTH_TYPE: ${authType}`,
        `GOOGLE_ADS_GCLOUD_USE_CLI: ${useCli}`,
        `GOOGLE_ADS_CREDENTIALS_PATH: ${credsPath}`,
        `GOOGLE_ADS_CUSTOMER_ID: ${customerId}`,
        `GOOGLE_ADS_LOGIN_CUSTOMER_ID: ${loginCustomerId}`,
        `GOOGLE_ADS_DEVELOPER_TOKEN: ${developerToken ? "(set)" : "(not set)"}`,
        "Notes:",
        "- For 'gcloud/adc' mode, credentials path is not required.",
        "- Prefer ADC over CLI fallback for stability and auto-refresh.",
        "- oauth and service_account modes remain available for compatibility.",
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // Manage auth tool (status implemented)
  server.tool(
    {
      name: "manage_auth",
      description:
        "Manage Google Ads auth: status (implemented), switch/refresh (TBD).",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: { type: "string", description: "status | switch | refresh", default: "status" },
          config_name: { type: "string", description: "gcloud config for switch (TBD)" },
        },
      },
    },
    async (input: any) => {
      const action = (input?.action || 'status').toLowerCase();
      if (action !== 'status') {
        return { content: [{ type: 'text', text: `Action '${action}' not implemented. Use 'status'.` }] };
      }

      const lines: string[] = [
        'Google Ads Auth Status',
        '=======================',
      ];
      try {
        const { token, quotaProjectId, type } = await (await import('./auth.js')).getAccessToken();
        lines.push(`Auth type: ${type}`);
        lines.push(`Token present: ${token ? 'yes' : 'no'}`);
        lines.push(`Quota project: ${quotaProjectId || '(none)'}`);
        // Probe scope by hitting listAccessibleCustomers
        const resp = await listAccessibleCustomers();
        if (resp.ok) {
          lines.push('Ads scope check: OK');
          const count = resp.data?.resourceNames?.length || 0;
          lines.push(`Accessible accounts: ${count}`);
        } else if (resp.status === 403 && (resp.errorText || '').includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
          lines.push('Ads scope check: missing scope (ACCESS_TOKEN_SCOPE_INSUFFICIENT)');
        } else {
          lines.push(`Ads scope check: HTTP ${resp.status}`);
        }
      } catch (e: any) {
        lines.push(`Error determining auth status: ${e?.message || String(e)}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );

  // Execute GAQL query tool (basic)
  server.tool(
    {
      name: "execute_gaql_query",
      description: "Execute a GAQL query against the Google Ads API (v19).",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          customer_id: { type: "string", description: "10-digit customer ID (no dashes)" },
          query: { type: "string", description: "GAQL query string" },
        },
        required: ["customer_id", "query"],
      },
    },
    async (input: any) => {
      const res = await executeGaql({ customerId: input.customer_id, query: input.query });
      if (!res.ok) {
        return { content: [{ type: "text", text: `Error executing query (status ${res.status}): ${res.errorText || ""}` }] };
      }
      const data = res.data;
      if (!data?.results || !Array.isArray(data.results) || data.results.length === 0) {
        return { content: [{ type: "text", text: "No results found for the query." }] };
      }
      const first = data.results[0];
      const fields: string[] = [];
      for (const key of Object.keys(first)) {
        const val = (first as any)[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const sub of Object.keys(val)) fields.push(`${key}.${sub}`);
        } else {
          fields.push(key);
        }
      }
      const table = tabulate(data.results, fields);
      const lines: string[] = ["Query Results:", table];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // List accessible accounts
  server.tool(
    {
      name: "list_accounts",
      description: "List accessible Google Ads accounts (customers:listAccessibleCustomers)",
      input_schema: { type: "object", additionalProperties: false, properties: {} },
    },
    async () => {
      const res = await listAccessibleCustomers();
      if (!res.ok) {
        return { content: [{ type: "text", text: `Error: ${res.errorText || `status ${res.status}`}` }] };
      }
      const names = res.data?.resourceNames || [];
      if (!names.length) {
        return { content: [{ type: "text", text: "No accessible accounts found." }] };
      }
      const lines: string[] = ["Accessible Google Ads Accounts:", "-".repeat(50)];
      for (const rn of names) {
        const id = rn.split('/').pop() || rn;
        lines.push(`Account ID: ${formatCustomerId(id)}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // Unified performance tool
  server.tool(
    {
      name: "get_performance",
      description: "Get performance at campaign, ad_group, or ad level with currency.",
      input_schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          customer_id: { type: "string", description: "10-digit customer ID (no dashes)" },
          level: { type: "string", enum: ["campaign", "ad_group", "ad"], description: "Aggregation level" },
          days: { type: "number", default: 30 },
          limit: { type: "number", default: 50 },
          filters: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string" },
              nameContains: { type: "string" },
              campaignNameContains: { type: "string" },
              minClicks: { type: "number" },
              minImpressions: { type: "number" },
            },
          },
        },
        required: ["customer_id", "level"],
      },
    },
    async (input: any) => {
      const query = buildPerformanceQuery(input.level, input.days ?? 30, input.limit ?? 50, input.filters || {});
      const res = await executeGaql({ customerId: input.customer_id, query });
      if (!res.ok) {
        return { content: [{ type: "text", text: `Error executing performance query (status ${res.status}): ${res.errorText || ""}` }] };
      }
      const data = res.data;
      if (!data?.results || data.results.length === 0) {
        return { content: [{ type: "text", text: "No results found for the selected period." }] };
      }
      const first = data.results[0];
      const fields: string[] = [];
      for (const key of Object.keys(first)) {
        const val = (first as any)[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const sub of Object.keys(val)) fields.push(`${key}.${sub}`);
        } else {
          fields.push(key);
        }
      }
      const table = tabulate(data.results, fields);
      const lines: string[] = [
        `Performance (${input.level}) for last ${input.days ?? 30} days:`,
        table,
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
