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
