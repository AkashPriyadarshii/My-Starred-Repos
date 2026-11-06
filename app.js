'use strict';

const STOP_WORDS = new Set([
  'the', 'and', 'or', 'in', 'to', 'for', 'with', 'a', 'an', 'is', 'of', 'on', 'at',
  'by', 'from', 'as', 'that', 'this', 'it', 'are', 'was', 'be', 'into', 'using',
  'build', 'building', 'create', 'make', 'app', 'project', 'tool', 'system', 'need',
  'want', 'best', 'good', 'my', 'we', 'our', 'like', 'some', 'any'
]);

// Private mode / disabled storage throws on access, and a corrupt value must not
// blank the page: both reads degrade to defaults instead of aborting the module.
function readStore(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}
function readJSONStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* storage full or blocked */ }
}

const state = {
  repos: [],
  query: '',
  category: 'all',
  lang: 'all',
  sort: 'stars-desc',
  pinned: new Set(readJSONStore('starred_pinned', [])),
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

function escapeHTML(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text, q) {
  const safe = text || '';
  if (!q) return escapeHTML(safe);
  const escaped = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return escapeHTML(safe).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

// Upstream descriptions carry emoji and ZWJ sequences; the table reads as data, not decoration.
const EMOJI_RE = /[\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]|[\u{1F000}-\u{1FAFF}]/gu;
function stripEmoji(s) {
  return (s || '').replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
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

// ── URL state ───────────────────────────────────────────────────────────────

function syncUrlParams() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('cat', state.category);
  if (state.lang !== 'all') params.set('lang', state.lang);
  if (state.sort !== 'stars-desc') params.set('sort', state.sort);

  const qs = params.toString();
  window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
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
}

// ── Pins ────────────────────────────────────────────────────────────────────

function updatePinnedCount() {
  const el = $('pinned-count');
  if (el) el.textContent = state.pinned.size;
}

function togglePin(repoName) {
  if (state.pinned.has(repoName)) {
    state.pinned.delete(repoName);
    showToast(`Unpinned ${repoName}`);
  } else {
    state.pinned.add(repoName);
    showToast(`Pinned ${repoName}`);
  }
  writeStore('starred_pinned', JSON.stringify(Array.from(state.pinned)));
  updatePinnedCount();

  document.querySelectorAll(`.pin-btn[data-repo="${CSS.escape(repoName)}"]`).forEach(btn => {
    const isPinned = state.pinned.has(repoName);
    btn.classList.toggle('active', isPinned);
    btn.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
    btn.title = isPinned ? 'Unpin repository' : 'Pin repository';
  });

  if (state.category === 'pinned') renderGrid();
}

// ── Copy ────────────────────────────────────────────────────────────────────

async function copyCloneCommand(url, name) {
  const cmd = `git clone ${url}.git`;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(cmd);
    } else {
      const ta = document.createElement('textarea');
      ta.value = cmd;
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
    // No cache-buster: the CDN's max-age + SWR window is the freshness contract.
    const res = await fetch('./repos_output.json');
    if (!res.ok) throw new Error('Failed to load repos_output.json');

    const data = await res.json();
    state.repos = data.repos || [];

    loadUrlParams();
    renderProfile(data.profile, data.generated_at);
    buildLangFilter();
    updatePinnedCount();
    syncLedger();
    renderGrid();
  } catch (err) {
    $('grid').innerHTML = `<div class="empty"><p>Failed to load data. ${escapeHTML(err.message)}</p></div>`;
  }
}

// ── Header ──────────────────────────────────────────────────────────────────

function renderProfile(profile, generatedAt) {
  if (profile && profile.name) $('profile-name').textContent = profile.name;
  renderSnapshotAge(generatedAt);
}

// The page reads a baked snapshot, not live GitHub data. Show its real age.
function renderSnapshotAge(generatedAt) {
  const badge = $('sync-badge');
  const label = $('sync-label');
  if (!badge || !label) return;
  const when = generatedAt ? new Date(generatedAt) : null;
  if (!when || isNaN(when)) {
    label.textContent = 'snapshot';
    badge.title = 'Baked snapshot of the GitHub API';
    return;
  }
  const days = Math.floor((Date.now() - when.getTime()) / 86400000);
  label.textContent = days <= 0 ? 'snapshot today' : `snapshot ${days}d old`;
  badge.title = `Baked snapshot generated ${when.toISOString().slice(0, 10)}. Refresh with fetch_stars.py.`;
}

// ── Ledger (server-rendered; JS only reflects state) ────────────────────────

function syncLedger() {
  const active = state.category;
  document.querySelectorAll('[data-cat]').forEach(el => {
    if (!el.classList.contains('ledger-key') && !el.classList.contains('ledger-seg')) return;
    el.setAttribute('aria-pressed', el.dataset.cat === active ? 'true' : 'false');
  });
  const bar = $('ledger-bar');
  if (bar) bar.classList.toggle('dimmed', active !== 'all');
}

function setCategory(cat) {
  state.category = cat || 'all';
  syncLedger();
  renderGrid();
}

// ── Language filter ─────────────────────────────────────────────────────────

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

// ── Project matcher ─────────────────────────────────────────────────────────

function runProjectMatcher(inputText) {
  const text = (inputText || '').trim().toLowerCase();
  const statusEl = $('matcher-status');

  if (!text) {
    state.isMatching = false;
    state.matchScores.clear();
    if (statusEl) statusEl.textContent = '';
    renderGrid();
    return;
  }

  const tokens = text.replace(/[^a-z0-9+#.-]+/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP_WORDS.has(t));
  if (!tokens.length) {
    if (statusEl) statusEl.textContent = 'Add a few more specific words.';
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
      const finalScore = score + Math.log10(Math.max(repo.stars, 10)) * 0.5;
      if (finalScore > maxScore) maxScore = finalScore;
      state.matchScores.set(repo.full_name, { score: finalScore });
    }
  });

  state.matchScores.forEach(val => {
    val.percent = Math.min(Math.round((val.score / maxScore) * 100), 99);
  });

  state.isMatching = true;
  if (statusEl) statusEl.textContent = `${state.matchScores.size} repos scored`;
  renderGrid();
  $('grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Rows ────────────────────────────────────────────────────────────────────

function createRow(repo, i) {
  const isPinned = state.pinned.has(repo.full_name);
  const match = state.isMatching ? state.matchScores.get(repo.full_name) : null;

  const row = document.createElement('article');
  row.className = 'row';
  row.setAttribute('role', 'listitem');
  row.dataset.index = i;
  row.innerHTML = `
    <span class="row-rank num">${i + 1}</span>
    <div class="row-main">
      <a href="${escapeHTML(repo.url)}" target="_blank" rel="noopener" class="row-name">${highlight(repo.full_name, state.query)}</a>
      <p class="row-desc">${highlight(stripEmoji(repo.description) || 'No description', state.query)}</p>
      ${match ? `<span class="row-tags"><span class="tag tag-match">${match.percent}% match</span></span>` : ''}
      ${repo.archived ? '<span class="row-tags"><span class="tag">archived</span></span>' : ''}
    </div>
    <span class="row-lang">${escapeHTML(repo.language || 'n/a')}</span>
    <span class="row-stars num">${formatNum(repo.stars)}</span>
    <div class="row-actions">
      <button class="icon-btn pin-btn ${isPinned ? 'active' : ''}" data-repo="${escapeHTML(repo.full_name)}" title="${isPinned ? 'Unpin repository' : 'Pin repository'}" aria-pressed="${isPinned}" aria-label="Pin ${escapeHTML(repo.full_name)}">
        <svg viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      </button>
      <button class="icon-btn copy-btn" data-url="${escapeHTML(repo.url)}" data-name="${escapeHTML(repo.full_name)}" title="Copy git clone command" aria-label="Copy clone command for ${escapeHTML(repo.full_name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      </button>
    </div>
  `;
  return row;
}

// ── Progressive batch rendering ─────────────────────────────────────────────

const BATCH_SIZE = 80;
let currentFiltered = [];
let renderedCount = 0;
let observer = null;

function renderNextBatch() {
  if (renderedCount >= currentFiltered.length) return;

  const grid = $('grid');
  $('grid-sentinel')?.remove();

  const frag = document.createDocumentFragment();
  const nextSlice = currentFiltered.slice(renderedCount, renderedCount + BATCH_SIZE);
  nextSlice.forEach((repo, i) => frag.appendChild(createRow(repo, renderedCount + i)));
  renderedCount += nextSlice.length;
  grid.appendChild(frag);

  if (renderedCount < currentFiltered.length) {
    const sentinel = document.createElement('div');
    sentinel.id = 'grid-sentinel';
    sentinel.style.height = '1px';
    grid.appendChild(sentinel);

    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) renderNextBatch();
    }, { rootMargin: '600px' });
    observer.observe(sentinel);
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
    } else if (state.category !== 'all' && (r.category || '').toLowerCase() !== state.category) {
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

  const countEl = $('result-count');
  if (countEl) {
    countEl.textContent = `${currentFiltered.length} of ${state.repos.length}${state.isMatching ? ' matched' : ''}`;
  }

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

// ── Keyboard focus ──────────────────────────────────────────────────────────

function updateKeyboardFocus(newIndex) {
  const items = document.querySelectorAll('#grid > article');
  if (!items.length) return;

  items[state.focusedIndex]?.classList.remove('keyboard-focus');
  state.focusedIndex = Math.max(0, Math.min(newIndex, items.length - 1));
  const activeItem = items[state.focusedIndex];
  activeItem.classList.add('keyboard-focus');
  activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Events ──────────────────────────────────────────────────────────────────

function initEvents() {
  let debounce;
  const clearSearchTimer = () => clearTimeout(debounce);

  $('search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    $('search-clear')?.classList.toggle('hidden', !q);
    clearSearchTimer();
    debounce = setTimeout(() => { state.query = q; renderGrid(); }, 100);
  });

  $('search-clear')?.addEventListener('click', () => {
    const input = $('search');
    if (input) input.value = '';
    $('search-clear')?.classList.add('hidden');
    clearSearchTimer();
    state.query = '';
    renderGrid();
  });

  $('lang-filter')?.addEventListener('change', e => {
    state.lang = e.target.value;
    renderGrid();
  });

  $('sort')?.addEventListener('change', e => {
    state.sort = e.target.value;
    renderGrid();
  });

  // Ledger keys and segments both filter by category.
  $('ledger-keys')?.addEventListener('click', e => {
    const key = e.target.closest('.ledger-key');
    if (!key) return;
    const cat = key.dataset.cat;
    setCategory(state.category === cat && cat !== 'pinned' ? 'all' : cat);
  });

  $('ledger-bar')?.addEventListener('click', e => {
    const seg = e.target.closest('.ledger-seg');
    if (!seg) return;
    setCategory(state.category === seg.dataset.cat ? 'all' : seg.dataset.cat);
  });

  // Matcher drawer
  const toggleMatcher = open => {
    const panel = $('matcher-panel');
    const btn = $('matcher-toggle-btn');
    if (!panel) return;
    panel.classList.toggle('hidden', !open);
    btn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) $('matcher-input')?.focus();
  };

  $('matcher-toggle-btn')?.addEventListener('click', () => {
    toggleMatcher($('matcher-panel')?.classList.contains('hidden'));
  });
  $('matcher-close-btn')?.addEventListener('click', () => toggleMatcher(false));
  $('matcher-submit-btn')?.addEventListener('click', () => runProjectMatcher($('matcher-input')?.value));
  $('matcher-reset-btn')?.addEventListener('click', () => {
    const input = $('matcher-input');
    if (input) input.value = '';
    runProjectMatcher('');
  });

  // Delegated row actions
  document.addEventListener('click', e => {
    const chip = e.target.closest('.matcher-chip');
    if (chip) {
      const prompt = chip.dataset.prompt || chip.textContent.trim();
      const input = $('matcher-input');
      if (input) {
        input.value = prompt;
        runProjectMatcher(prompt);
      }
      return;
    }

    const pinBtn = e.target.closest('.pin-btn');
    if (pinBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (pinBtn.dataset.repo) togglePin(pinBtn.dataset.repo);
      return;
    }

    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (copyBtn.dataset.url) copyCloneCommand(copyBtn.dataset.url, copyBtn.dataset.name);
      return;
    }

    const row = e.target.closest('#grid > article');
    if (row && !e.target.closest('a') && !e.target.closest('button')) {
      const link = row.querySelector('.row-name');
      if (link && link.href) window.open(link.href, '_blank', 'noopener');
    }
  });

  $('empty-reset')?.addEventListener('click', () => {
    clearSearchTimer();
    state.query = '';
    state.category = 'all';
    state.lang = 'all';
    state.isMatching = false;
    state.matchScores.clear();
    const input = $('search');
    if (input) input.value = '';
    $('search-clear')?.classList.add('hidden');
    if ($('lang-filter')) $('lang-filter').value = 'all';
    if ($('matcher-input')) $('matcher-input').value = '';
    if ($('matcher-status')) $('matcher-status').textContent = '';
    toggleMatcher(false);
    syncLedger();
    renderGrid();
  });

  document.addEventListener('keydown', e => {
    const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    if (e.key === '/' && !isTyping) {
      e.preventDefault();
      $('search')?.focus();
      return;
    }

    if (e.key === 'Escape') {
      if (document.activeElement === $('search')) {
        $('search').blur();
        if (state.query) {
          clearSearchTimer();
          $('search').value = '';
          $('search-clear')?.classList.add('hidden');
          state.query = '';
          renderGrid();
        }
      } else if (!$('matcher-panel')?.classList.contains('hidden')) {
        toggleMatcher(false);
      }
      return;
    }

    if (isTyping) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      updateKeyboardFocus(state.focusedIndex + 1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      updateKeyboardFocus(state.focusedIndex - 1);
    } else if (e.key === 'Enter' && state.focusedIndex >= 0) {
      const link = document.querySelectorAll('#grid > article')[state.focusedIndex]?.querySelector('.row-name');
      if (link && link.href) window.open(link.href, '_blank', 'noopener');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  fetchData();
});
