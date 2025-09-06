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
  filter: z.string().optional().describe('substring filter on resource name'),
  limit: z.number().default(500).describe('max rows (1-1000)'),
  output_format: z.enum(['table', 'json', 'csv']).default('table').describe('render format'),
});
export const ListResourcesSchema: JsonSchema = zodToJsonSchema(ListResourcesZ, 'ListResources') as unknown as JsonSchema;

// Execute GAQL schema
export const ExecuteGaqlZ = z.object({
  customer_id: z.string().describe('10-digit customer ID (no dashes)'),
  query: z.string().describe('GAQL query string'),
  page_size: z.number().min(1).optional().describe('optional page size (API pagination)'),
  page_token: z.string().optional().describe('optional page token (API pagination)'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
});
export const ExecuteGaqlSchema: JsonSchema = zodToJsonSchema(ExecuteGaqlZ, 'ExecuteGaql') as unknown as JsonSchema;

// Get Performance schema
export const GetPerformanceZ = z.object({
  customer_id: z.string().describe('10-digit customer ID (no dashes)'),
  level: z.enum(['campaign','ad_group','ad']).describe('Aggregation level'),
  days: z.number().default(30).describe('Days back to query (default 30)'),
  limit: z.number().default(50).describe('GAQL LIMIT (default 50)'),
  page_size: z.number().min(1).optional().describe('optional page size (API pagination)'),
  page_token: z.string().optional().describe('optional page token (API pagination)'),
  auto_paginate: z.boolean().default(false).describe('fetch multiple pages automatically'),
  max_pages: z.number().min(1).max(20).default(5).describe('limit when auto_paginate=true (1-20)'),
  output_format: z.enum(['table','json','csv']).default('table').describe('render format'),
  filters: z.object({
    status: z.string().optional().describe('e.g., ENABLED, PAUSED'),
    nameContains: z.string().optional().describe('substring in entity name'),
    campaignNameContains: z.string().optional().describe('substring in campaign name'),
    minClicks: z.number().optional().describe('minimum clicks'),
    minImpressions: z.number().optional().describe('minimum impressions'),
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
