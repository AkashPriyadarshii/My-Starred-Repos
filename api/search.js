// Serverless API endpoint for AI agents, MCP servers, and external tools to query starred repos
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const filePath = path.join(process.cwd(), 'repos_output.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const { q = '', category = 'all', lang = 'all', limit = 20, sort = 'stars-desc' } = req.query;
    const query = String(q).trim().toLowerCase();
    // Normalize category slugs — docs use slugs (ai, dev-tools) but stored categories are display names (AI & Agents, Dev Tools)
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
    let catRaw = String(category).trim();
    if (catRaw.toLowerCase() !== 'all') {
      const catKey = catRaw.toLowerCase();
      catRaw = CATEGORY_ALIASES[catKey] || catRaw;
    }
    const catFilter = catRaw.toLowerCase();
    const langFilter = String(lang).trim().toLowerCase();
    const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    let filtered = data.repos || [];

    if (catFilter !== 'all') {
      filtered = filtered.filter(r => (r.category || '').toLowerCase() === catFilter);
    }
    if (langFilter !== 'all') {
      filtered = filtered.filter(r => (r.language || '').toLowerCase() === langFilter);
    }
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean);
      filtered = filtered.filter(r => {
        const text = `${r.full_name} ${r.description || ''} ${r.language || ''} ${r.category || ''} ${(r.topics || []).join(' ')}`.toLowerCase();
        return tokens.every(token => text.includes(token));
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      if (sort === 'stars-asc') return a.stars - b.stars;
      if (sort === 'name-asc') return a.full_name.localeCompare(b.full_name);
      if (sort === 'updated-desc') return new Date(b.last_updated) - new Date(a.last_updated);
      return b.stars - a.stars;
    });

    const totalMatches = filtered.length;
    const results = filtered.slice(0, maxLimit);

    return res.status(200).json({
      schema_version: '0.2',
      total_tracked: data.total_repos,
      total_matches: totalMatches,
      limit: maxLimit,
      query: query || null,
      category: catFilter !== 'all' ? catFilter : null,
      language: langFilter !== 'all' ? langFilter : null,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process search query', message: err.message });
  }
}
