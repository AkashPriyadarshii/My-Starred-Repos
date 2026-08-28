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

const STOP_WORDS = new Set([
  'the', 'and', 'or', 'in', 'to', 'for', 'with', 'a', 'an', 'is', 'of', 'on', 'at',
  'by', 'from', 'as', 'that', 'this', 'it', 'are', 'was', 'be', 'into', 'using',
  'build', 'building', 'create', 'make', 'app', 'project', 'tool', 'system', 'need',
  'want', 'best', 'good', 'my', 'we', 'our', 'like', 'some', 'any'
]);

const state = {
  repos: [],
  query: '',
  category: 'all',
  lang: 'all',
  sort: 'stars-desc',
  view: localStorage.getItem('starred_view_mode') || 'grid',
  pinned: new Set(JSON.parse(localStorage.getItem('starred_pinned') || '[]')),
  matchScores: new Map(), // full_name -> { score, percent }
  isMatching: false,
  focusedIndex: -1,
};

function $(id) { return document.getElementById(id); }

function formatNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'b';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm';
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
  if (diff < 2592000000) return Math.floor(diff / 86400000) + 'd ago';
  if (diff < 31536000000) return Math.floor(diff / 2592000000) + 'mo ago';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('visible');
    toast.classList.add('hidden');
  }, 2200);
}

// ── URL State Synchronization ───────────────────────────────────────────────

function syncUrlParams() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('cat', state.category);
  if (state.lang !== 'all') params.set('lang', state.lang);
  if (state.sort !== 'stars-desc') params.set('sort', state.sort);
  if (state.view !== 'grid') params.set('view', state.view);

  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function loadUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('q')) {
    state.query = params.get('q').trim().toLowerCase();
    const searchInput = $('search');
    if (searchInput) {
      searchInput.value = state.query;
      $('search-clear')?.classList.remove('hidden');
    }
  }
  if (params.has('cat')) {
    state.category = params.get('cat').trim().toLowerCase();
  }
  if (params.has('lang')) {
    state.lang = params.get('lang').trim().toLowerCase();
  }
  if (params.has('sort')) {
    state.sort = params.get('sort').trim();
    if ($('sort')) $('sort').value = state.sort;
  }
  if (params.has('view')) {
    const v = params.get('view').trim();
    if (v === 'compact' || v === 'grid') state.view = v;
  }
}

// ── Bookmarks / Pinned ──────────────────────────────────────────────────────

function updatePinnedCount() {
  const el = $('pinned-count');
  if (el) el.textContent = state.pinned.size;
}

function togglePin(repoName) {
  if (state.pinned.has(repoName)) {
    state.pinned.delete(repoName);
    showToast(`Removed from pinned`);
  } else {
    state.pinned.add(repoName);
    showToast(`Pinned ⭐ ${repoName}`);
  }
  localStorage.setItem('starred_pinned', JSON.stringify(Array.from(state.pinned)));
  updatePinnedCount();

  document.querySelectorAll(`.pin-btn[data-repo="${CSS.escape(repoName)}"]`).forEach(btn => {
    const isPinned = state.pinned.has(repoName);
    btn.classList.toggle('active', isPinned);
    btn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
    btn.title = isPinned ? 'Unpin repository' : 'Pin repository';
  });

  if (state.category === 'pinned') {
    renderGrid();
  }
}

// ── Copy Helper ─────────────────────────────────────────────────────────────

async function copyCloneCommand(url, name) {
  const cloneCmd = `git clone ${url}.git`;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(cloneCmd);
    } else {
      const ta = document.createElement('textarea');
      ta.value = cloneCmd;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast(`Copied: git clone ${name}.git`);
  } catch (e) {
    showToast(`Clone URL: ${url}.git`);
  }
}

// ── Data ────────────────────────────────────────────────────────────────────

async function fetchData() {
  try {
    const cb = `?t=${Date.now()}`;
    const reposRes = await fetch(`./repos_output.json${cb}`);

    if (!reposRes.ok) {
      throw new Error('Failed to load repos_output.json');
    }

    const data = await reposRes.json();
    state.repos = data.repos || [];

    loadUrlParams();
    renderProfile(data.profile);
    renderMetrics();
    buildCategoryTabs();
    buildLangFilter();
    updatePinnedCount();
    applyViewMode(state.view);
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
  if (!tabs) return;

  tabs.innerHTML = `
    <button class="cat-tab ${state.category === 'all' ? 'active' : ''}" data-cat="all" role="tab" aria-selected="${state.category === 'all'}">All (${state.repos.length})</button>
    <button class="cat-tab cat-tab-pinned ${state.category === 'pinned' ? 'active' : ''}" data-cat="pinned" role="tab" aria-selected="${state.category === 'pinned'}">📌 Pinned (<span id="pinned-count">${state.pinned.size}</span>)</button>
  `;

  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([cat, count]) => {
    const btn = document.createElement('button');
    const catLower = cat.toLowerCase();
    const isActive = state.category === catLower;
    btn.className = `cat-tab ${isActive ? 'active' : ''}`;
    btn.dataset.cat = catLower;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.textContent = `${cat} (${count})`;
    tabs.appendChild(btn);
  });
}

// ── Language Filter ─────────────────────────────────────────────────────────

function buildLangFilter() {
  const langs = {};
  state.repos.forEach(r => {
    if (r.language && r.language !== 'Unknown') langs[r.language] = (langs[r.language] || 0) + 1;
  });

  const sel = $('lang-filter');
  if (!sel) return;

  sel.innerHTML = '<option value="all">All languages</option>';
  Object.keys(langs).sort().forEach(lang => {
    const opt = document.createElement('option');
    const langLower = lang.toLowerCase();
    opt.value = langLower;
    opt.textContent = `${lang} (${langs[lang]})`;
    if (state.lang === langLower) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ── View Mode Switcher ──────────────────────────────────────────────────────

function applyViewMode(mode) {
  state.view = mode;
  localStorage.setItem('starred_view_mode', mode);

  const grid = $('grid');
  if (grid) grid.classList.toggle('view-compact', mode === 'compact');

  $('view-grid-btn')?.classList.toggle('active', mode === 'grid');
  $('view-compact-btn')?.classList.toggle('active', mode === 'compact');
  syncUrlParams();
}

// ── Vibe Coder Project Relevance Matcher ─────────────────────────────────────

function runProjectMatcher(inputText) {
  const text = (inputText || '').trim().toLowerCase();
  if (!text) {
    state.isMatching = false;
    state.matchScores.clear();
    const statusEl = $('matcher-status');
    if (statusEl) statusEl.textContent = '';
    renderGrid();
    return;
  }

  const rawTokens = text.replace(/[^a-z0-9+#.-]+/g, ' ').split(/\s+/).filter(Boolean);
  const tokens = rawTokens.filter(t => t.length > 1 && !STOP_WORDS.has(t));

  if (!tokens.length) {
    const statusEl = $('matcher-status');
    if (statusEl) statusEl.textContent = 'Please enter more specific keywords or stack details.';
    return;
  }

  state.matchScores.clear();
  let maxScore = 0;

  state.repos.forEach(repo => {
    let score = 0;
    const name = repo.full_name.toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const lang = (repo.language || '').toLowerCase();
    const cat = (repo.category || '').toLowerCase();
    const topics = (repo.topics || []).map(t => t.toLowerCase());

    tokens.forEach(tok => {
      if (topics.some(t => t.includes(tok))) score += 6;
      if (name.includes(tok)) score += 5;
      if (lang === tok || lang.includes(tok)) score += 4;
      if (cat.includes(tok)) score += 3;
      if (desc.includes(tok)) score += 2;
    });

    if (score > 0) {
      const starBoost = Math.log10(Math.max(repo.stars, 10)) * 0.5;
      const finalScore = score + starBoost;
      if (finalScore > maxScore) maxScore = finalScore;
      state.matchScores.set(repo.full_name, { score: finalScore });
    }
  });

  state.matchScores.forEach((val) => {
    val.percent = Math.min(Math.round((val.score / maxScore) * 100), 99);
  });

  state.isMatching = true;
  const matchCount = state.matchScores.size;
  const statusEl = $('matcher-status');
  if (statusEl) statusEl.textContent = `Found ${matchCount} relevant projects!`;

  renderGrid();
  $('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Card & Row Creation ─────────────────────────────────────────────────────

function createCard(repo, i) {
  const isPinned = state.pinned.has(repo.full_name);
  const langColor = LANG_COLORS[repo.language] || LANG_COLORS.Unknown;
  const matchData = state.isMatching ? state.matchScores.get(repo.full_name) : null;
  const matchPill = matchData ? `<span class="card-match-pill" title="Relevance match score">${matchData.percent}% Match</span>` : '';
  const archivedPill = repo.archived ? `<span class="card-archived-pill">Archived</span>` : '';

  if (state.view === 'compact') {
    const row = document.createElement('article');
    row.className = 'compact-row';
    row.setAttribute('role', 'listitem');
    row.dataset.index = i;
    row.innerHTML = `
      <div class="compact-left">
        <button class="pin-btn ${isPinned ? 'active' : ''}" data-repo="${escapeHTML(repo.full_name)}" title="${isPinned ? 'Unpin' : 'Pin'}" aria-label="Pin repository">
          <svg viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
        <span class="compact-rank">#${repo.rank || i + 1}</span>
        <a href="${escapeHTML(repo.url)}" target="_blank" rel="noopener" class="compact-name">${highlight(repo.full_name, state.query)}</a>
        ${matchPill}
        ${archivedPill}
        <span class="compact-desc">${highlight(repo.description || '', state.query)}</span>
      </div>
      <div class="compact-right">
        <span class="card-lang"><span class="lang-dot" style="background:${langColor}"></span>${repo.language || 'N/A'}</span>
        <span class="compact-stars">★ ${formatNum(repo.stars)}</span>
        <button class="copy-btn" data-url="${escapeHTML(repo.url)}" data-name="${escapeHTML(repo.full_name)}" title="Copy git clone" aria-label="Copy clone command">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>
    `;
    return row;
  }

  const card = document.createElement('article');
  card.className = 'card';
  card.setAttribute('role', 'listitem');
  card.dataset.index = i;
  card.style.animationDelay = `${Math.min((i % BATCH_SIZE) * 0.02, 0.4)}s`;

  card.innerHTML = `
    <div class="card-top">
      <div class="card-title-wrap">
        <button class="pin-btn ${isPinned ? 'active' : ''}" data-repo="${escapeHTML(repo.full_name)}" title="${isPinned ? 'Unpin' : 'Pin'}" aria-label="Pin repository">
          <svg viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
        <a href="${escapeHTML(repo.url)}" target="_blank" rel="noopener" class="card-name">${highlight(repo.full_name, state.query)}</a>
      </div>
      <div class="card-top-right">
        ${matchPill}
        ${archivedPill}
        <div class="card-stars">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          ${formatNum(repo.stars)}
        </div>
      </div>
    </div>
    <p class="card-desc">${highlight(repo.description || 'No description', state.query)}</p>
    <div class="card-meta">
      <span class="card-lang">
        <span class="lang-dot" style="background:${langColor}"></span>
        ${repo.language || 'N/A'}
      </span>
      <span class="card-date" title="Last update">${formatDate(repo.last_updated)}</span>
      <div class="card-actions">
        <button class="copy-btn" data-url="${escapeHTML(repo.url)}" data-name="${escapeHTML(repo.full_name)}" title="Copy git clone command" aria-label="Copy clone command">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
        <a href="${escapeHTML(repo.url)}" target="_blank" rel="noopener" class="card-link" aria-label="Open on GitHub">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
        </a>
      </div>
    </div>
  `;
  return card;
}

// ── Progressive Batch Rendering ─────────────────────────────────────────────

const BATCH_SIZE = 60;
let currentFiltered = [];
let renderedCount = 0;
let observer = null;

function renderNextBatch() {
  if (renderedCount >= currentFiltered.length) return;

  const grid = $('grid');
  const sentinel = $('grid-sentinel');
  if (sentinel) sentinel.remove();

  const frag = document.createDocumentFragment();
  const nextSlice = currentFiltered.slice(renderedCount, renderedCount + BATCH_SIZE);
  nextSlice.forEach((repo, i) => {
    frag.appendChild(createCard(repo, renderedCount + i));
  });
  renderedCount += nextSlice.length;
  grid.appendChild(frag);

  if (renderedCount < currentFiltered.length) {
    const newSentinel = document.createElement('div');
    newSentinel.id = 'grid-sentinel';
    newSentinel.style.height = '1px';
    newSentinel.style.gridColumn = '1 / -1';
    grid.appendChild(newSentinel);

    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderNextBatch();
      }
    }, { rootMargin: '400px' });
    observer.observe(newSentinel);
  }
}

function renderGrid() {
  const grid = $('grid');
  grid.innerHTML = '';
  state.focusedIndex = -1;

  if (observer) {
    observer.disconnect();
    observer = null;
  }

  currentFiltered = state.repos.filter(r => {
    if (state.category === 'pinned') {
      if (!state.pinned.has(r.full_name)) return false;
    } else if (state.category !== 'all' && r.category.toLowerCase() !== state.category) {
      return false;
    }

    if (state.lang !== 'all' && (r.language || '').toLowerCase() !== state.lang) return false;

    if (state.isMatching && !state.matchScores.has(r.full_name)) return false;

    if (state.query) {
      const hay = `${r.full_name} ${r.description || ''} ${r.language || ''} ${r.category || ''} ${(r.topics || []).join(' ')}`.toLowerCase();
      if (!hay.includes(state.query)) return false;
    }
    return true;
  });

  // Sort
  currentFiltered.sort((a, b) => {
    if (state.isMatching) {
      const scoreA = state.matchScores.get(a.full_name)?.score || 0;
      const scoreB = state.matchScores.get(b.full_name)?.score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
    }

    switch (state.sort) {
      case 'stars-asc': return a.stars - b.stars;
      case 'name-asc': return a.full_name.localeCompare(b.full_name);
      case 'updated-desc': return new Date(b.last_updated) - new Date(a.last_updated);
      default: return b.stars - a.stars;
    }
  });

  // Result count
  const matchIndicator = state.isMatching ? ` (Project Matches)` : '';
  const countEl = $('result-count');
  if (countEl) countEl.textContent = `${currentFiltered.length} of ${state.repos.length}${matchIndicator}`;

  // Empty state
  if (!currentFiltered.length) {
    grid.classList.add('hidden');
    $('empty-state')?.classList.remove('hidden');
    syncUrlParams();
    return;
  }
  grid.classList.remove('hidden');
  $('empty-state')?.classList.add('hidden');

  renderedCount = 0;
  renderNextBatch();
  syncUrlParams();
}

// ── Keyboard Navigation Helper ──────────────────────────────────────────────

function updateKeyboardFocus(newIndex) {
  const items = document.querySelectorAll('#grid > article');
  if (!items.length) return;

  if (state.focusedIndex >= 0 && state.focusedIndex < items.length) {
    items[state.focusedIndex].classList.remove('keyboard-focus');
  }

  state.focusedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
  const activeItem = items[state.focusedIndex];
  activeItem.classList.add('keyboard-focus');
  activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Events ──────────────────────────────────────────────────────────────────

function initEvents() {
  // Search input
  let debounce;
  $('search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $('search-clear')?.classList.toggle('hidden', !q);
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.query = q; renderGrid(); }, 100);
  });

  $('search-clear')?.addEventListener('click', () => {
    const input = $('search');
    if (input) input.value = '';
    $('search-clear')?.classList.add('hidden');
    state.query = '';
    renderGrid();
  });

  // Language filter
  $('lang-filter')?.addEventListener('change', e => {
    state.lang = e.target.value;
    renderGrid();
  });

  // Sort
  $('sort')?.addEventListener('change', e => {
    state.sort = e.target.value;
    renderGrid();
  });

  // View toggle
  $('view-grid-btn')?.addEventListener('click', () => applyViewMode('grid'));
  $('view-compact-btn')?.addEventListener('click', () => applyViewMode('compact'));

  // Category Tabs Click Delegation
  $('category-tabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    state.category = btn.dataset.cat;
    renderGrid();
  });

  // Project Matcher
  $('matcher-toggle-btn')?.addEventListener('click', () => {
    const panel = $('matcher-panel');
    const isHidden = panel.classList.toggle('hidden');
    if (!isHidden) {
      $('matcher-input')?.focus();
    }
  });

  $('matcher-close-btn')?.addEventListener('click', () => {
    $('matcher-panel')?.classList.add('hidden');
  });

  $('matcher-submit-btn')?.addEventListener('click', () => {
    const val = $('matcher-input')?.value;
    runProjectMatcher(val);
  });

  $('matcher-reset-btn')?.addEventListener('click', () => {
    const input = $('matcher-input');
    if (input) input.value = '';
    runProjectMatcher('');
  });

  // Matcher Quick Suggestion Chips Delegation
  document.addEventListener('click', e => {
    const chip = e.target.closest('.matcher-chip');
    if (chip) {
      const promptText = chip.dataset.prompt || chip.textContent.trim();
      const input = $('matcher-input');
      if (input) {
        input.value = promptText;
        runProjectMatcher(promptText);
      }
      return;
    }

    const pinBtn = e.target.closest('.pin-btn');
    if (pinBtn) {
      e.preventDefault();
      e.stopPropagation();
      const repo = pinBtn.dataset.repo;
      if (repo) togglePin(repo);
      return;
    }

    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const url = copyBtn.dataset.url;
      const name = copyBtn.dataset.name;
      if (url) copyCloneCommand(url, name);
      return;
    }

    const badge = e.target.closest('.seo-topic-badge');
    if (badge) {
      const query = badge.dataset.query || badge.textContent.trim();
      const searchInput = $('search');
      if (searchInput) {
        searchInput.value = query;
        $('search-clear')?.classList.remove('hidden');
        state.query = query.toLowerCase();
        state.category = 'all';
        document.querySelectorAll('.cat-tab').forEach((t, i) => {
          t.classList.toggle('active', i === 0);
          t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        });
        renderGrid();
        $('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // Card / row click to open repository on GitHub
    const article = e.target.closest('#grid > article');
    if (article && !e.target.closest('a') && !e.target.closest('button')) {
      const link = article.querySelector('.card-name, .compact-name');
      if (link && link.href) {
        window.open(link.href, '_blank', 'noopener');
      }
    }
  });

  // Empty reset
  $('empty-reset')?.addEventListener('click', () => {
    state.query = '';
    state.category = 'all';
    state.lang = 'all';
    state.isMatching = false;
    state.matchScores.clear();
    const searchInput = $('search');
    if (searchInput) searchInput.value = '';
    $('search-clear')?.classList.add('hidden');
    if ($('lang-filter')) $('lang-filter').value = 'all';
    if ($('matcher-input')) $('matcher-input').value = '';
    if ($('matcher-status')) $('matcher-status').textContent = '';
    $('matcher-panel')?.classList.add('hidden');
    document.querySelectorAll('.cat-tab').forEach((t, i) => {
      t.classList.toggle('active', i === 0);
      t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    });
    renderGrid();
  });

  // Keyboard navigation & shortcuts
  document.addEventListener('keydown', e => {
    const isTyping = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';

    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      $('search')?.focus();
      return;
    }

    if (e.key === 'Escape') {
      if (document.activeElement === $('search')) {
        $('search').blur();
        if (state.query) {
          $('search').value = '';
          $('search-clear')?.classList.add('hidden');
          state.query = '';
          renderGrid();
        }
      } else if (!$('matcher-panel')?.classList.contains('hidden')) {
        $('matcher-panel')?.classList.add('hidden');
      }
      return;
    }

    if (!isTyping) {
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        updateKeyboardFocus(state.focusedIndex + 1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        updateKeyboardFocus(state.focusedIndex - 1);
      } else if (e.key === 'Enter' && state.focusedIndex >= 0) {
        const items = document.querySelectorAll('#grid > article');
        const activeItem = items[state.focusedIndex];
        const link = activeItem?.querySelector('.card-name, .compact-name');
        if (link && link.href) {
          window.open(link.href, '_blank', 'noopener');
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
