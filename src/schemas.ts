import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type JsonSchema = Record<string, unknown>;

// Manage Auth schema (centralized with descriptions to help LLMs)
export const ManageAuthZ = z.object({
  action: z.enum(['status', 'switch', 'refresh']).default('status').describe('status | switch | refresh'),
  config_name: z.string().optional().describe('gcloud configuration name (for switch)'),
  allow_subprocess: z.boolean().optional().describe('execute gcloud steps (default true). Set false to only print commands.'),
});
export const ManageAuthSchema: JsonSchema = zodToJsonSchema(ManageAuthZ, 'ManageAuth') as unknown as JsonSchema;

// List Resources schema (supports GAQL resources or accounts)
export const ListResourcesZ = z.object({
  kind: z.enum(['resources', 'accounts']).default('resources').describe('what to list: resources | accounts'),
  filter: z.string().optional().describe('substring filter on resource name'),
  limit: z.number().default(500).describe('max rows (1-1000)'),
  output_format: z.enum(['table', 'json', 'csv']).default('table').describe('render format'),
});
export const ListResourcesSchema: JsonSchema = zodToJsonSchema(ListResourcesZ, 'ListResources') as unknown as JsonSchema;

// Execute GAQL schema (canonical snake_case only)
export const ExecuteGaqlZ = z.object({
  customer_id: z.string().optional().describe('10-digit customer ID (no dashes). Optional.'),
  // Per-call login customer (MCC/manager) override
  login_customer_id: z.union([z.string(), z.number()]).optional().describe('Manager account (MCC) ID to use as login-customer for this request (10 digits, no dashes). Overrides env GOOGLE_ADS_MANAGER_ACCOUNT_ID.'),

  query: z.string().describe(
    [
      'GAQL query string. Examples:',
      "SELECT campaign.id, campaign.name, metrics.clicks FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 10",
      "SELECT ad_group_ad.ad.id, metrics.impressions FROM ad_group_ad WHERE campaign.status = 'ENABLED' LIMIT 50",
    ].join('\n')
  ),
  page_size: z.number().min(1).optional().describe('optional page size (1-10000)'),
  page_token: z.string().optional().describe('optional page token'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
});
export const ExecuteGaqlSchema: JsonSchema = zodToJsonSchema(ExecuteGaqlZ, 'ExecuteGaql') as unknown as JsonSchema;

// Get Performance schema (canonical snake_case only)
export const GetPerformanceZ = z.object({
  customer_id: z.string().optional().describe('10-digit customer ID (no dashes). Optional.'),
  // Per-call login customer (MCC/manager) override
  login_customer_id: z.union([z.string(), z.number()]).optional().describe('Manager account (MCC) ID to use as login-customer for this request (10 digits, no dashes). Overrides env GOOGLE_ADS_MANAGER_ACCOUNT_ID.'),

  level: z.enum(['account','campaign','ad_group','ad']).describe('Aggregation level'),
  days: z.number().default(30).describe('Days back to query (1-365, default 30)'),
  limit: z.number().default(50).describe('GAQL LIMIT (1-1000, default 50)'),
  page_size: z.number().min(1).optional().describe('optional page size (1-10000)'),
  page_token: z.string().optional().describe('optional page token'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
  filters: z.object({
    status: z.string().optional().describe('e.g., ENABLED, PAUSED'),
    name_contains: z.string().optional().describe('substring in entity name (case sensitive)'),
    campaign_name_contains: z.string().optional().describe('substring in campaign name (case sensitive)'),
    min_clicks: z.number().optional().describe('minimum clicks (>=0)'),
    min_impressions: z.number().optional().describe('minimum impressions (>=0)'),
  }).optional().describe('optional performance filters'),
});
export const GetPerformanceSchema: JsonSchema = zodToJsonSchema(GetPerformanceZ, 'GetPerformance') as unknown as JsonSchema;

// GAQL Help schema
export const GaqlHelpZ = z.object({
  topic: z.enum(['overview', 'grammar', 'structure', 'date-ranges', 'case-sensitivity', 'ordering-limiting', 'cookbook', 'field-reference']).optional().describe('specific GAQL topic to retrieve'),
  search: z.string().optional().describe('search term for help content'),
});
export const GaqlHelpSchema: JsonSchema = zodToJsonSchema(GaqlHelpZ, 'GaqlHelp') as unknown as JsonSchema;
