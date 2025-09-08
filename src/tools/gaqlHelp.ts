import fs from 'node:fs/promises';
import path from 'node:path';
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

const AVAILABLE_TOPICS = [
  'overview', 'grammar', 'structure', 'date-ranges', 
  'case-sensitivity', 'ordering-limiting', 'cookbook', 'field-reference'
] as const;

async function readSpecificTopic(topic: string): Promise<string | null> {
  const gaqlDir = path.resolve(process.cwd(), 'resources/gaql');
  const filePath = path.join(gaqlDir, `${topic}.md`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return `=== ${topic.toUpperCase().replace('-', ' ')} ===\n${content}`;
  } catch {
    return null;
  }
}


export async function gaqlHelp(input: GaqlHelpInput = {}): Promise<string> {
  const sections: string[] = [];
  const version = getApiVersion();
  
  // If specific topic requested, return just that topic
  if (input.topic) {
    const topicContent = await readSpecificTopic(input.topic);
    if (topicContent) {
      sections.push(`# GAQL Help: ${input.topic.replace('-', ' ').toUpperCase()}`);
      sections.push(`**API Version**: ${version}\n`);
      sections.push(topicContent);
      
      // Add relevant official documentation link
      const officialUrl = OFFICIAL_URLS[input.topic.replace('-', '_') as keyof typeof OFFICIAL_URLS];
      if (officialUrl) {
        sections.push(`\n**Official Documentation**: ${officialUrl}`);
      }
      sections.push(`\n**Field References**: ${getFieldReferenceUrls().join(', ')}`);
      
      return sections.join('\n');
    } else {
      return `Topic "${input.topic}" not found. Available topics: ${AVAILABLE_TOPICS.join(', ')}`;
    }
  }
  
  // Default: Show overview with available topics
  sections.push('# Google Ads Query Language (GAQL) Help');
  
  // Show available topics
  sections.push(`
## Available Topics
Use the topic parameter to get specific documentation:
${AVAILABLE_TOPICS.map(topic => `- **${topic}**: ${topic.replace('-', ' ')} documentation`).join('\n')}

Example: Use topic="overview" for basic GAQL concepts`);

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

  // Footer
  sections.push(`
## Need More Help?
- Use topic parameter to get detailed documentation on specific areas
- Use the "list_resources" tool to discover available resources and their fields
- Use the "execute_gaql_query" tool to test your queries
- Check field compatibility in the official API reference above`);

  return sections.join('\n');
}