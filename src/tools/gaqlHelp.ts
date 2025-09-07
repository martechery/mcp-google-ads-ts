import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Simple in-memory cache for fetched pages during server lifetime
const pageCache = new Map<string, string>();

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
  // Chunk on headers, code fences, or blank lines — favors meaningful blocks
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];
  let cur: string[] = [];
  let inFence = false;
  const flush = () => { if (cur.length) { chunks.push(cur.join('\n').trim()); cur = []; } };
  for (const raw of lines) {
    const ln = raw ?? '';
    if (/^```/.test(ln)) {
      inFence = !inFence; // toggle
      cur.push(ln);
      if (!inFence) { flush(); }
      continue;
    }
    if (!inFence && (/^\s*$/.test(ln) || /^\s*(=|#){2,}/.test(ln))) {
      flush();
      continue;
    }
    cur.push(ln);
  }
  flush();
  return chunks.filter(Boolean);
}

function scoreChunk(chunk: string, query: string, includeExamples?: boolean): number {
  const q = (query || '').toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
  const c = chunk.toLowerCase();
  let score = 0;
  for (const term of q) if (c.includes(term)) score += 1;
  // Prefer chunks with GAQL signals
  if (/select\s+.+from\s+/i.test(chunk)) score += 2;
  if (/order by|limit|during|where/i.test(chunk)) score += 1;
  if (/```/.test(chunk)) score += includeExamples ? 3 : 1;
  return score;
}

async function fetchText(url: string): Promise<string> {
  // Cache within process to avoid repeat fetches
  if (pageCache.has(url)) return pageCache.get(url)!;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  const text = await res.text();
  pageCache.set(url, text);
  return text;
}

async function tryReadLocalDocs(): Promise<{ text: string | null; pathTried?: string[] }> {
  const tried: string[] = [];
  const candidates: string[] = [];
  // 1) CWD/docs (common when running from repo root)
  candidates.push(path.resolve(process.cwd(), 'docs/gaql.md'));
  // 2) Relative to compiled file dist/tools → ../../docs/gaql.md
  try {
    const thisFile = fileURLToPath(import.meta.url);
    candidates.push(path.resolve(path.dirname(thisFile), '../../docs/gaql.md'));
  } catch {
    // ignore
  }
  for (const p of candidates) {
    tried.push(p);
    try {
      const txt = await fs.readFile(p, 'utf8');
      return { text: txt, pathTried: tried };
    } catch {
      // try next
    }
  }
  return { text: null, pathTried: tried };
}

export async function gaqlHelp(input: GaqlHelpInput): Promise<string> {
  // Single sane default: hybrid behavior with offline-first docs + best-effort online
  const quick = !!input.quick_tips; // no env toggle
  const includeExamples = !!input.include_examples;
  const maxCharsBase = Math.max(400, Math.min(8000, Number(input.max_chars ?? 1800)));
  const maxChars = includeExamples ? Math.min(12000, Math.floor(maxCharsBase * 1.5)) : maxCharsBase;
  if (quick) return getQuickTips();

  const topics: Topic[] = (Array.isArray(input.topics) && input.topics.length)
    ? (input.topics as Topic[])
    : ['overview','grammar','structure','ordering','date_ranges','cookbook'];

  let corpus = '';
  // Always include local docs first (offline-first)
  {
    const { text: local, pathTried } = await tryReadLocalDocs();
    if (local) {
      corpus += `\n\n===== LOCAL DOCS (docs/gaql.md) =====\n${local}`;
    } else {
      corpus += `\n\n===== LOCAL DOCS (docs/gaql.md) =====\n[Local docs not found]\nTried: ${(pathTried || []).join('\n')}`;
    }
  }

  // Also attempt to fetch official docs (best-effort)
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
    .map((c) => ({ c, s: scoreChunk(c, input.question || '', includeExamples) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, includeExamples ? 16 : 10)
    .map((x) => x.c.trim());

  const header = 'GAQL help (condensed)';
  const sources: string[] = [];
  sources.push('Local: docs/gaql.md');
  sources.push(...topics.map((t) => `${t}: ${TOPIC_URLS[t]}`));

  let out = [header, sources.length ? `Sources:\n- ${sources.join('\n- ')}` : '']
    .filter(Boolean)
    .concat(scored)
    .join('\n\n');
  if (out.length > maxChars) out = out.slice(0, maxChars - 3) + '...';
  return out;
}
