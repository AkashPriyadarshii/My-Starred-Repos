// Read-only search API over repos_output.json for AI agents, MCP servers and tools.
// Contract: GET only, unknown enum -> 400, absent or empty filter means "no filter",
// every response carries the snapshot age so callers can judge staleness.
import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'repos_output.json');
const SORTS = ['stars-desc', 'stars-asc', 'name-asc', 'updated-desc'];

// Docs use slugs (ai, dev-tools); the dataset stores display names (AI & Agents, Dev Tools).
const CATEGORY_ALIASES = {
  'ai': 'AI & Agents',
  'ai-agents': 'AI & Agents',
  'ai_agents': 'AI & Agents',
  'agents': 'AI & Agents',
  'ai & agents': 'AI & Agents',
  'dev-tools': 'Dev Tools',
  'dev_tools': 'Dev Tools',
  'devtools': 'Dev Tools',
  'dev tools': 'Dev Tools',
  'web-automation': 'Web Automation',
  'web_automation': 'Web Automation',
  'web automation': 'Web Automation',
  'automation': 'Web Automation',
  'llm-rag': 'LLM & RAG',
  'llm_rag': 'LLM & RAG',
  'llm & rag': 'LLM & RAG',
  'rag': 'LLM & RAG',
  'web-dev': 'Web Dev',
  'web_dev': 'Web Dev',
  'webdev': 'Web Dev',
  'web dev': 'Web Dev',
  'databases': 'Databases',
  'database': 'Databases',
  'db': 'Databases',
  'devops': 'DevOps',
  'dev-ops': 'DevOps',
  'dev_ops': 'DevOps',
  'security': 'Security',
  'mobile': 'Mobile',
  'media': 'Media',
  'other': 'Other',
};

// The file only changes on deploy, so one parse per warm instance is enough.
let memo = { mtimeMs: 0, data: null };

function loadData() {
  const stat = fs.statSync(DATA_PATH);
  if (memo.data && memo.mtimeMs === stat.mtimeMs) return memo.data;
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  memo = { mtimeMs: stat.mtimeMs, data };
  return data;
}

const firstValue = (v) => (Array.isArray(v) ? v[0] : v);
const clean = (v) => String(firstValue(v) ?? '').trim();

function fail(res, status, code, message, extra) {
  return res.status(status).json({ error: { code, message, ...extra } });
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS');
    return fail(res, 405, 'method_not_allowed', 'Only GET is supported.');
  }

  try {
    const data = loadData();
    const query = clean(req.query.q).toLowerCase();
    const rawCategory = clean(req.query.category);
    const rawLang = clean(req.query.lang);
    const rawSort = clean(req.query.sort) || 'stars-desc';

    // An empty or "all" filter is the same as no filter, never "match nothing".
    const isAll = (v) => !v || v.toLowerCase() === 'all';

    const sort = rawSort.toLowerCase();
    if (!SORTS.includes(sort)) {
      return fail(res, 400, 'invalid_sort', `Unknown sort "${rawSort}".`, { allowed: SORTS });
    }

    const categories = [...new Set((data.repos || []).map((r) => r.category || 'Other'))];
    let category = null;
    if (!isAll(rawCategory)) {
      const alias = CATEGORY_ALIASES[rawCategory.toLowerCase()];
      category = alias || categories.find((c) => c.toLowerCase() === rawCategory.toLowerCase()) || null;
      if (!category) {
        return fail(res, 400, 'invalid_category', `Unknown category "${rawCategory}".`, { allowed: categories });
      }
    }

    const langFilter = isAll(rawLang) ? '' : rawLang.toLowerCase();
    const limit = Math.min(Math.max(parseInt(firstValue(req.query.limit), 10) || 20, 1), 100);
    const offset = Math.max(parseInt(firstValue(req.query.offset), 10) || 0, 0);

    let filtered = data.repos || [];
    if (category) filtered = filtered.filter((r) => (r.category || 'Other') === category);
    if (langFilter) filtered = filtered.filter((r) => (r.language || '').toLowerCase() === langFilter);
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean);
      filtered = filtered.filter((r) => {
        const text = `${r.full_name} ${r.description || ''} ${r.language || ''} ${r.category || ''} ${(r.topics || []).join(' ')}`.toLowerCase();
        return tokens.every((token) => text.includes(token));
      });
    }

    filtered.sort((a, b) => {
      if (sort === 'stars-asc') return a.stars - b.stars;
      if (sort === 'name-asc') return String(a.full_name).localeCompare(String(b.full_name));
      if (sort === 'updated-desc') return new Date(b.last_updated) - new Date(a.last_updated);
      return b.stars - a.stars;
    });

    const generatedAt = data.generated_at ? new Date(data.generated_at) : null;
    const ageSeconds = generatedAt && !isNaN(generatedAt)
      ? Math.max(0, Math.round((Date.now() - generatedAt.getTime()) / 1000))
      : null;
    if (ageSeconds !== null) {
      res.setHeader('X-Data-Age', String(ageSeconds));
      res.setHeader('Warning', `110 - "Snapshot is ${Math.floor(ageSeconds / 86400)} days old"`);
    }

    const pageItems = filtered.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length < filtered.length ? offset + pageItems.length : null;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      schema_version: data.schema_version || 1,
      generated_at: data.generated_at || null,
      data_age_seconds: ageSeconds,
      sync_mode: data.sync_mode || null,
      total_tracked: data.total_repos,
      total_matches: filtered.length,
      limit,
      offset,
      next_offset: nextOffset,
      query: query || null,
      category,
      language: langFilter || null,
      sort,
      results: pageItems,
    });
  } catch (err) {
    // Never echo err.message: it can carry absolute server paths.
    console.error('search failed:', err && err.name);
    return fail(res, 500, 'internal_error', 'Failed to read the repository snapshot.');
  }
}
