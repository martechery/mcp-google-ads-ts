import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeApiVersion } from '../utils/normalizeApiVersion.js';

export type GaqlHelpInput = {
  topic?: string;
  search?: string;
};

// Official documentation URLs
const OFFICIAL_URLS = {
  overview: 'https://developers.google.com/google-ads/api/docs/query/overview',
  grammar: 'https://developers.google.com/google-ads/api/docs/query/grammar',
  structure: 'https://developers.google.com/google-ads/api/docs/query/structure',
  date_ranges: 'https://developers.google.com/google-ads/api/docs/query/date-ranges',
  case_sensitivity: 'https://developers.google.com/google-ads/api/docs/query/case-sensitivity',
  ordering: 'https://developers.google.com/google-ads/api/docs/query/ordering-limiting',
  cookbook: 'https://developers.google.com/google-ads/api/docs/query/cookbook',
};

function getApiVersion(): string {
  return normalizeApiVersion(process.env.GOOGLE_ADS_API_VERSION);
}

function getFieldReferenceUrls(): string[] {
  const version = getApiVersion();
  return [
    `${version} Field Reference: https://developers.google.com/google-ads/api/reference/rpc/${version}/overview`,
    `${version} Query Builder: https://developers.google.com/google-ads/api/fields/${version}/overview_query_builder`,
  ];
}

async function readLocalDocs(): Promise<string[]> {
  const docs: string[] = [];
  const gaqlDir = path.resolve(process.cwd(), 'docs/gaql');
  
  const docFiles = [
    'overview.md',
    'grammar.md', 
    'structure.md',
    'date-ranges.md',
    'case-sensitivity.md',
    'ordering-limiting.md',
    'cookbook.md',
    'field-reference.md'
  ];
  
  for (const file of docFiles) {
    try {
      const filePath = path.join(gaqlDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      docs.push(`=== ${file.replace('.md', '').toUpperCase()} ===\n${content}`);
    } catch {
      // Skip missing files silently
    }
  }
  
  // Fallback to original gaql.md if structured docs not found
  if (docs.length === 0) {
    try {
      const fallbackPath = path.resolve(process.cwd(), 'docs/gaql.md');
      const content = await fs.readFile(fallbackPath, 'utf8');
      docs.push(`=== GAQL CHEAT SHEET ===\n${content}`);
    } catch {
      // No local docs available
    }
  }
  
  return docs;
}

export async function gaqlHelp(input: GaqlHelpInput = {}): Promise<string> {
  const sections: string[] = [];
  
  // Header
  sections.push('# Google Ads Query Language (GAQL) Help');
  
  // Quick Tips
  sections.push(`
## Quick Tips
- FROM uses a RESOURCE (use list_resources tool to discover available resources)
- SELECT fields must be selectable for the chosen FROM resource
- WHERE supports =, !=, <, >, >=, <=, LIKE, IN, DURING (for date ranges)
- Date ranges: DURING LAST_7_DAYS, LAST_30_DAYS, THIS_MONTH, etc.
- ORDER BY field [ASC|DESC], LIMIT n for sorting and limiting results
- Case sensitivity: field names are case-insensitive; string values are case-sensitive
- Cost fields are in micros - divide by 1,000,000 for actual currency amounts
- Use customer.currency_code to interpret cost_micros correctly`);

  // API Version Info
  const version = getApiVersion();
  sections.push(`
## Current API Version: ${version}
The MCP server is configured to use API version ${version}. 
Set GOOGLE_ADS_API_VERSION environment variable to use a different version.`);

  // Official Documentation Links
  sections.push(`
## Official Documentation
${Object.entries(OFFICIAL_URLS).map(([topic, url]) => `- ${topic.replace('_', ' ')}: ${url}`).join('\n')}

## Field References
${getFieldReferenceUrls().join('\n')}`);

  // Local Documentation
  const localDocs = await readLocalDocs();
  if (localDocs.length > 0) {
    sections.push('\n## Local Documentation\n');
    sections.push(...localDocs);
  } else {
    sections.push('\n## Local Documentation\nNo local GAQL documentation found in docs/gaql/ directory.');
  }

  // Footer
  sections.push(`
## Need More Help?
- Use the "list_resources" tool to discover available resources and their fields
- Use the "execute_gaql_query" tool to test your queries
- Check field compatibility in the official API reference above`);

  return sections.join('\n');
}