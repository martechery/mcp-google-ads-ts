import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type JsonSchema = Record<string, unknown>;

// Manage Auth schema (centralized with descriptions to help LLMs)
export const ManageAuthZ = z.object({
  action: z.enum(['status', 'switch', 'refresh']).default('status').describe('status | switch | refresh'),
  config_name: z.string().optional().describe('gcloud configuration name (for switch)'),
  allow_subprocess: z.boolean().default(false).describe('allow running gcloud subprocesses'),
});
export const ManageAuthSchema: JsonSchema = zodToJsonSchema(ManageAuthZ, 'ManageAuth') as unknown as JsonSchema;

// List Resources schema (supports GAQL resources or accounts)
export const ListResourcesZ = z.object({
  kind: z.enum(['resources', 'accounts']).default('resources').describe('what to list: resources | accounts'),
  resource: z.string().optional().describe('Alias of kind ("accounts" or "resources").'),
  filter: z.string().optional().describe('substring filter on resource name'),
  limit: z.number().default(500).describe('max rows (1-1000)'),
  output_format: z.enum(['table', 'json', 'csv']).default('table').describe('render format'),
  outputFormat: z.enum(['table','json','csv']).optional().describe('Alias of output_format.'),
});
export const ListResourcesSchema: JsonSchema = zodToJsonSchema(ListResourcesZ, 'ListResources') as unknown as JsonSchema;

// Execute GAQL schema
// (aliases normalized at runtime in handlers)

export const ExecuteGaqlZ = z.object({
  customer_id: z.string().optional().describe('10-digit customer ID (no dashes). Optional.'),
  customerId: z.union([z.string(), z.number()]).optional().describe('Alias of customer_id.'),
  query: z.string().describe(
    [
      'GAQL query string. Examples:',
      "SELECT campaign.id, campaign.name, metrics.clicks FROM campaign WHERE segments.date DURING LAST_30_DAYS LIMIT 10",
      "SELECT ad_group_ad.ad.id, metrics.impressions FROM ad_group_ad WHERE campaign.status = 'ENABLED' LIMIT 50",
    ].join('\n')
  ),
  page_size: z.number().min(1).optional().describe('optional page size (1-10000)'),
  pageSize: z.number().min(1).optional().describe('Alias of page_size.'),
  page_token: z.string().optional().describe('optional page token'),
  pageToken: z.string().optional().describe('Alias of page_token.'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  autoPaginate: z.boolean().optional().describe('Alias of auto_paginate.'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  maxPages: z.number().min(1).max(20).optional().describe('Alias of max_pages.'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
  outputFormat: z.enum(['table','json','csv']).optional().describe('Alias of output_format.'),
});
export const ExecuteGaqlSchema: JsonSchema = zodToJsonSchema(ExecuteGaqlZ, 'ExecuteGaql') as unknown as JsonSchema;

// Get Performance schema
export const GetPerformanceZ = z.object({
  customer_id: z.string().optional().describe('10-digit customer ID (no dashes). Optional.'),
  customerId: z.union([z.string(), z.number()]).optional().describe('Alias of customer_id.'),
  level: z.enum(['account','campaign','ad_group','ad']).describe('Aggregation level'),
  days: z.number().default(30).describe('Days back to query (1-365, default 30)'),
  limit: z.number().default(50).describe('GAQL LIMIT (1-1000, default 50)'),
  page_size: z.number().min(1).optional().describe('optional page size (1-10000)'),
  pageSize: z.number().min(1).optional().describe('Alias of page_size.'),
  page_token: z.string().optional().describe('optional page token'),
  pageToken: z.string().optional().describe('Alias of page_token.'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  autoPaginate: z.boolean().optional().describe('Alias of auto_paginate.'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  maxPages: z.number().min(1).max(20).optional().describe('Alias of max_pages.'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
  outputFormat: z.enum(['table','json','csv']).optional().describe('Alias of output_format.'),
  filters: z.object({
    status: z.string().optional().describe('e.g., ENABLED, PAUSED'),
    nameContains: z.string().optional().describe('substring in entity name (case sensitive)'),
    campaignNameContains: z.string().optional().describe('substring in campaign name (case sensitive)'),
    minClicks: z.number().optional().describe('minimum clicks (>=0)'),
    minImpressions: z.number().optional().describe('minimum impressions (>=0)'),
  }).optional().describe('optional performance filters'),
});
export const GetPerformanceSchema: JsonSchema = zodToJsonSchema(GetPerformanceZ, 'GetPerformance') as unknown as JsonSchema;

// GAQL Help schema
export const GaqlHelpZ = z.object({
  question: z.string().optional().describe('your GAQL question or keywords'),
  topics: z.array(z.string()).optional().describe('subset of topics to search'),
  quick_tips: z.boolean().default(false).describe('return built-in cheat-sheet without network'),
  include_examples: z.boolean().default(false).describe('reserve space for examples (best-effort)'),
  max_chars: z.number().min(400).max(4000).optional().describe('max characters to return (400-4000)'),
});
export const GaqlHelpSchema: JsonSchema = zodToJsonSchema(GaqlHelpZ, 'GaqlHelp') as unknown as JsonSchema;
