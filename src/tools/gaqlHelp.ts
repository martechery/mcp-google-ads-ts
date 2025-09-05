type Topic = 'overview' | 'grammar' | 'structure' | 'date_ranges' | 'case_sensitivity' | 'ordering' | 'cookbook';

const TOPIC_URLS: Record<Topic, string> = {
  overview: 'https://developers.google.com/google-ads/api/docs/query/overview',
  grammar: 'https://developers.google.com/google-ads/api/docs/query/grammar',
  structure: 'https://developers.google.com/google-ads/api/docs/query/structure',
  date_ranges: 'https://developers.google.com/google-ads/api/docs/query/date-ranges',
  case_sensitivity: 'https://developers.google.com/google-ads/api/docs/query/case-sensitivity',
  ordering: 'https://developers.google.com/google-ads/api/docs/query/ordering-limiting',
  cookbook: 'https://developers.google.com/google-ads/api/docs/query/cookbook',
};

export type GaqlHelpInput = {
  question?: string;
  topics?: Topic[];
  quick_tips?: boolean;
  include_examples?: boolean;
  max_chars?: number;
};

function getQuickTips(): string {
  return [
    'GAQL quick tips:',
    '- FROM uses a RESOURCE (see list_resources).',
    '- SELECT fields must be selectable for the chosen FROM.',
    '- WHERE supports =, !=, LIKE, IN, DURING (date ranges).',
    '- Date ranges: DURING LAST_7_DAYS, THIS_MONTH, CUSTOM_DATE.',
    '- ORDER BY field [ASC|DESC], LIMIT n.',
    '- Case sensitivity: field names are case-insensitive; string matches are case-sensitive.',
    '- Use customer.currency_code to interpret cost_micros.',
  ].join('\n');
}

function extractChunks(text: string): string[] {
  // Keep headings, bullet lists, code fences, and paragraphs
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let cur: string[] = [];
  const push = () => { if (cur.length) { chunks.push(cur.join('\n')); cur = []; } };
  for (const ln of lines) {
    if (/^\s*$/.test(ln)) { push(); continue; }
    cur.push(ln);
  }
  push();
  return chunks;
}

function scoreChunk(chunk: string, query: string): number {
  const q = (query || '').toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  const c = chunk.toLowerCase();
  let score = 0;
  for (const term of q) if (c.includes(term)) score += 1;
  // Prefer chunks with GAQL signals
  if (/select\s+.+from\s+/i.test(chunk)) score += 2;
  if (/order by|limit|during|where/i.test(chunk)) score += 1;
  if (/```/.test(chunk)) score += 1;
  return score;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  return await res.text();
}

export async function gaqlHelp(input: GaqlHelpInput): Promise<string> {
  const quick = !!input.quick_tips || process.env.GAQL_HELP_OFFLINE === 'true';
  const maxChars = Math.max(400, Math.min(4000, Number(input.max_chars ?? 1600)));
  if (quick) return getQuickTips();

  const topics: Topic[] = (Array.isArray(input.topics) && input.topics.length)
    ? (input.topics as Topic[])
    : ['overview','grammar','structure','ordering','date_ranges','cookbook'];

  let corpus = '';
  for (const t of topics) {
    const url = TOPIC_URLS[t];
    try {
      const txt = await fetchText(url);
      // Strip HTML tags if present (best-effort)
      const clean = txt.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '\n');
      corpus += `\n\n===== ${t.toUpperCase()} (${url}) =====\n${clean}`;
    } catch (e) {
      corpus += `\n\n===== ${t.toUpperCase()} (${url}) =====\n[Failed to load: ${(e as any)?.message || e}]`;
    }
  }

  const chunks = extractChunks(corpus);
  const scored = chunks
    .map((c) => ({ c, s: scoreChunk(c, input.question || '') }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map((x) => x.c.trim());

  const header = 'GAQL help (condensed):';
  let out = [header].concat(scored).join('\n\n');
  if (out.length > maxChars) out = out.slice(0, maxChars - 3) + '...';
  return out;
}

