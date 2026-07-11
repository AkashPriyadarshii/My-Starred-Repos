'use strict';

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Rust: '#dea584',
  Go: '#00ADD8', Kotlin: '#A97BFF', Swift: '#F05138', Java: '#b07219',
  C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Ruby: '#701516',
  PHP: '#4F5D95', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c',
  Dart: '#00B4AB', Scala: '#c22d40', Lua: '#000080', Zig: '#ec915c',
  Nix: '#7e7eff', Elixir: '#6e4a7e', Haskell: '#5e5086', Clojure: '#db5855',
  Unknown: '#6b7280',
};

const state = {
  repos: [],
  query: '',
  category: 'all',
  lang: 'all',
  sort: 'stars-desc',
};

function $(id) { return document.getElementById(id); }

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return 'today';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHTML(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text, q) {
  const safe = text || '';
  if (!q) return escapeHTML(safe);
  const escaped = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return escapeHTML(safe).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// ── Data ────────────────────────────────────────────────────────────────────

async function fetchData() {
  try {
    const cb = `?t=${Date.now()}`;
    const [reposRes, changelogRes] = await Promise.allSettled([
      fetch(`./repos_output.json${cb}`),
    ]);

    if (reposRes.status !== 'fulfilled' || !reposRes.value.ok) {
      throw new Error('Failed to load repos_output.json');
    }

    const data = await reposRes.value.json();
    state.repos = data.repos || [];

    renderProfile(data.profile);
    renderMetrics();
    buildCategoryTabs();
    buildLangFilter();
    renderGrid();
  } catch (err) {
    $('grid').innerHTML = `<div class="empty-state"><p>Failed to load data. ${escapeHTML(err.message)}</p></div>`;
  }
}

// ── Profile ─────────────────────────────────────────────────────────────────

function renderProfile(profile) {
  if (!profile) return;

  const avatar = $('profile-avatar');
  const fallback = $('avatar-fallback');
  if (profile.avatar_url && avatar) {
    avatar.src = profile.avatar_url;
    avatar.onload = () => { avatar.classList.remove('hidden'); fallback.style.display = 'none'; };
    avatar.onerror = () => { avatar.classList.add('hidden'); };
  }

  if (profile.name) $('profile-name').textContent = profile.name;
  if (profile.bio) $('profile-bio').textContent = profile.bio;
  if (profile.followers != null) $('stat-followers').textContent = formatNum(profile.followers);
  if (profile.public_repos != null) $('stat-repos').textContent = formatNum(profile.public_repos);

  const badge = $('sync-badge');
  if (badge) {
    $('sync-label').textContent = 'live';
    badge.title = 'Profile synced live from GitHub API';
  }
}

// ── Metrics ─────────────────────────────────────────────────────────────────

function renderMetrics() {
  const repos = state.repos;
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const avgStars = repos.length ? Math.round(totalStars / repos.length) : 0;

  const langCounts = {};
  repos.forEach(r => {
    if (r.language && r.language !== 'Unknown') {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  });
  let topLang = '—', max = 0;
  for (const [l, c] of Object.entries(langCounts)) {
    if (c > max) { max = c; topLang = l; }
  }

  $('metric-stars').textContent = formatNum(totalStars);
  $('metric-repos').textContent = repos.length;
  $('metric-lang').textContent = topLang;
  $('metric-avg').textContent = formatNum(avgStars);
}

// ── Category Tabs ───────────────────────────────────────────────────────────

function buildCategoryTabs() {
  const cats = {};
  state.repos.forEach(r => { cats[r.category] = (cats[r.category] || 0) + 1; });

  const tabs = $('category-tabs');
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([cat, count]) => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab';
    btn.dataset.cat = cat.toLowerCase();
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.textContent = cat;
    tabs.appendChild(btn);
  });

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    tabs.querySelectorAll('.cat-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    state.category = btn.dataset.cat;
    renderGrid();
  });
}

// ── Language Filter ─────────────────────────────────────────────────────────

function buildLangFilter() {
  const langs = {};
  state.repos.forEach(r => {
    if (r.language && r.language !== 'Unknown') langs[r.language] = (langs[r.language] || 0) + 1;
  });

  const sel = $('lang-filter');
  Object.keys(langs).sort().forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.toLowerCase();
    opt.textContent = lang;
    sel.appendChild(opt);
  });
}

// ── Grid ────────────────────────────────────────────────────────────────────

function renderGrid() {
  const t0 = performance.now();
  const grid = $('grid');
  grid.innerHTML = '';

  let filtered = state.repos.filter(r => {
    if (state.category !== 'all' && r.category.toLowerCase() !== state.category) return false;
    if (state.lang !== 'all' && (r.language || '').toLowerCase() !== state.lang) return false;
    if (state.query) {
      const hay = `${r.full_name} ${r.description} ${r.language} ${r.category}`.toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    switch (state.sort) {
      case 'stars-asc': return a.stars - b.stars;
      case 'name-asc': return a.full_name.localeCompare(b.full_name);
      case 'updated-desc': return new Date(b.last_updated) - new Date(a.last_updated);
      default: return b.stars - a.stars;
    }
  });

  // Result count
  $('result-count').textContent = `${filtered.length} of ${state.repos.length}`;

  // Empty
  if (!filtered.length) {
    grid.classList.add('hidden');
    $('empty-state').classList.remove('hidden');
    return;
  }
  grid.classList.remove('hidden');
  $('empty-state').classList.add('hidden');

  // Render
  const frag = document.createDocumentFragment();
  filtered.forEach((repo, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${Math.min(i * 0.02, 0.6)}s`;

    const langColor = LANG_COLORS[repo.language] || LANG_COLORS.Unknown;

    card.innerHTML = `
      <div class="card-top">
        <a href="${repo.url}" target="_blank" rel="noopener" class="card-name">${highlight(repo.full_name, state.query)}</a>
        <div class="card-stars">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          ${formatNum(repo.stars)}
        </div>
      </div>
      <p class="card-desc">${highlight(repo.description || 'No description', state.query)}</p>
      <div class="card-meta">
        <span class="card-lang">
          <span class="lang-dot" style="background:${langColor}"></span>
          ${repo.language || 'N/A'}
        </span>
        <span class="card-date">${formatDate(repo.last_updated)}</span>
        <a href="${repo.url}" target="_blank" rel="noopener" class="card-link" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      </div>
    `;

    frag.appendChild(card);
  });

  grid.appendChild(frag);
  console.log(`Rendered ${filtered.length} cards in ${Math.round(performance.now() - t0)}ms`);
}

// ── Events ──────────────────────────────────────────────────────────────────

function initEvents() {
  // Search
  let debounce;
  $('search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $('search-clear').classList.toggle('hidden', !q);
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.query = q; renderGrid(); }, 120);
  });

  $('search-clear').addEventListener('click', () => {
    $('search').value = '';
    $('search-clear').classList.add('hidden');
    state.query = '';
    renderGrid();
  });

  // Language filter
  $('lang-filter').addEventListener('change', e => {
    state.lang = e.target.value;
    renderGrid();
  });

  // Sort
  $('sort').addEventListener('change', e => {
    state.sort = e.target.value;
    renderGrid();
  });

  // Empty reset
  $('empty-reset')?.addEventListener('click', () => {
    state.query = '';
    state.category = 'all';
    state.lang = 'all';
    $('search').value = '';
    $('search-clear').classList.add('hidden');
    $('lang-filter').value = 'all';
    $('category-tabs').querySelectorAll('.cat-tab').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
      t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    });
    renderGrid();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      $('search').focus();
    }
    if (e.key === 'Escape') {
      if (document.activeElement === $('search')) {
        $('search').blur();
        if (state.query) {
          $('search').value = '';
          $('search-clear').classList.add('hidden');
          state.query = '';
          renderGrid();
        }
      }
    }
  });
}

// ── Visitor Counter ─────────────────────────────────────────────────────────

function initVisitorCounter() {
  const KEY = 'starred-repos-views';
  const el = $('visitor-count');
  if (!el) return;

  let count = parseInt(localStorage.getItem(KEY) || '0', 10) + 1;
  localStorage.setItem(KEY, count);
  el.textContent = count.toLocaleString();
}

// ── Init ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  fetchData();
  initVisitorCounter();
});
