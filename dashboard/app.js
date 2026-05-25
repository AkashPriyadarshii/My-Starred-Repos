/**
 * ============================================================================
 * AkashPriyadarshii — Starred Repos Dashboard  |  app.js
 * Production-Grade SPA — No frameworks, no bundlers, pure JS
 * Features: PWA install, IST timestamps, keyboard shortcuts, lang filter,
 *           language stats, share, copy+toast, scroll-to-top, themes,
 *           trending badges, shareable URLs, font size control
 * ============================================================================
 */

'use strict';

// ─── IST Timezone Offset ────────────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * ============================================================================
 * 1. DIAGNOSTICS & LOGGING SYSTEM (AppLogger)
 * ============================================================================
 */
class AppLogger {
  constructor() {
    this.bufferSize = 500;
    this.logs = [];
    this.uiConsole = null;
  }

  setUIConsole(element) {
    this.uiConsole = element;
    this.flushToConsole();
  }

  log(level, module, event, payload = null, durationMs = 0) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      module: module.toUpperCase(),
      event,
      payload,
      duration_ms: durationMs
    };
    this.logs.push(entry);
    if (this.logs.length > this.bufferSize) this.logs.shift();
    this.appendLogToUI(entry);
    const msg = `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.event} ${payload ? JSON.stringify(payload) : ''} (${durationMs}ms)`;
    if (level === 'error' || level === 'fatal') console.error(msg);
    else if (level === 'warn') console.warn(msg);
    else console.log(msg);
  }

  appendLogToUI(entry) {
    if (!this.uiConsole) return;
    const div = document.createElement('div');
    div.className = `log-entry level-${entry.level}`;
    div.textContent = `[${entry.timestamp.split('T')[1].slice(0, 8)}] [${entry.level}] [${entry.module}] ${entry.event}`;
    this.uiConsole.appendChild(div);
    this.uiConsole.scrollTop = this.uiConsole.scrollHeight;
  }

  flushToConsole() {
    if (!this.uiConsole) return;
    this.uiConsole.innerHTML = '';
    this.logs.forEach(e => this.appendLogToUI(e));
  }

  downloadLogs() {
    this.log('info', 'storage', 'ExportingLogsStarted');
    try {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.logs, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      a.download = `starred_repos_diagnostics_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.log('info', 'storage', 'ExportingLogsCompleted');
    } catch (err) {
      this.log('error', 'storage', 'ExportingLogsFailed', { error: err.message });
    }
  }
}
const Logger = new AppLogger();

/**
 * ============================================================================
 * 2. CONFIG & STATE
 * ============================================================================
 */
const CONFIG_KEYS = {
  THEME:          'starred_repos_theme',
  DENSITY:        'starred_repos_density',
  MAX_CARDS:      'starred_repos_max_cards',
  FONT_SIZE:      'starred_repos_font_size',
  PARTICLES:      'starred_repos_particles',
  TILT:           'starred_repos_tilt',
  USER_MODE:      'starred_repos_user_mode',
  DEVICE_PROFILE: 'starred_repos_device_profile'
};

const state = {
  repos: [],
  changelogMarkdown: '',
  stats: {},
  activeCategory: 'all',
  activeSort: 'stars-desc',
  activeLang: 'all',
  searchQuery: '',
  maxVisibleCards: 350,
  density: 'comfortable',
  theme: 'tokyo-midnight',
  fontSize: 'medium',
  particlesEnabled: true,
  tiltEnabled: true,
  userMode: 'developer',
  deviceProfile: 'high',
  generatedAt: null
};

let particleBgInstance = null;

/**
 * ============================================================================
 * 3. PWA — SERVICE WORKER + INSTALL PROMPT
 * ============================================================================
 */
let deferredInstallPrompt = null;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const isGitHubPages = window.location.pathname.startsWith('/My-Starred-Repos/');
        const swPath = isGitHubPages ? '/My-Starred-Repos/dashboard/sw.js' : './sw.js';
        const scope = isGitHubPages ? '/My-Starred-Repos/' : './';
        const reg = await navigator.serviceWorker.register(swPath, { scope });
        Logger.log('info', 'pwa', 'ServiceWorkerRegistered', { scope: reg.scope });
      } catch (err) {
        Logger.log('warn', 'pwa', 'ServiceWorkerRegistrationFailed', { error: err.message });
      }
    });
  }
}

function initPWAInstall() {
  const installBtn = document.getElementById('install-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) {
      installBtn.classList.remove('hidden');
      installBtn.classList.add('pwa-pulse');
    }
    Logger.log('info', 'pwa', 'InstallPromptCaptured');
  });

  if (installBtn) {
    installBtn.addEventListener('click', triggerInstall);
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.classList.add('hidden');
    deferredInstallPrompt = null;
    showToast('✅ App installed! Find it on your home screen.', 'success');
    Logger.log('info', 'pwa', 'AppInstalled');
  });
}

async function triggerInstall() {
  if (!deferredInstallPrompt) {
    showToast('Already installed or browser does not support PWA install.', 'info');
    return;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  Logger.log('info', 'pwa', 'InstallOutcome', { outcome });
  deferredInstallPrompt = null;
  document.getElementById('install-btn')?.classList.add('hidden');
}

/**
 * ============================================================================
 * 4. INITIALIZATION
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  const t0 = performance.now();
  Logger.log('info', 'ui', 'AppInitializationStarted');

  registerServiceWorker();
  loadSettings();
  initUI();
  initPWAInstall();
  initScrollToTop();
  initKeyboardShortcuts();

  // Initialize particle background
  if (document.getElementById('canvas-particles')) {
    particleBgInstance = new ConstellationBackground();
    particleBgInstance.setActive(state.particlesEnabled);
  }

  fetchData()
    .then(() => Logger.log('info', 'ui', 'AppInitializationCompleted', null, Math.round(performance.now() - t0)))
    .catch(err => {
      Logger.log('fatal', 'ui', 'AppInitializationFailed', { error: err.message }, Math.round(performance.now() - t0));
      showErrorOverlay(err.message);
    });
});

let stagedSettings = {
  theme: 'tokyo-midnight',
  density: 'comfortable',
  fontSize: 'medium',
  maxVisibleCards: 350,
  particlesEnabled: true,
  tiltEnabled: true,
  userMode: 'developer',
  deviceProfile: 'high'
};

function applyActiveSettings() {
  document.documentElement.setAttribute('data-theme',    state.theme);
  document.documentElement.setAttribute('data-density',  state.density);
  document.documentElement.setAttribute('data-fontsize', state.fontSize);

  // Apply experience modes
  if (state.userMode === 'non-tech') {
    document.body.classList.add('non-tech-mode');
  } else {
    document.body.classList.remove('non-tech-mode');
  }

  // Apply device profiles
  if (state.deviceProfile === 'low') {
    document.body.classList.add('low-end-device');
  } else {
    document.body.classList.remove('low-end-device');
  }

  // Sync particle background activity
  if (particleBgInstance) {
    particleBgInstance.setActive(state.particlesEnabled && state.deviceProfile !== 'low');
    if (state.particlesEnabled && state.deviceProfile !== 'low') {
      particleBgInstance.init(); // updates colors for new theme
    }
  }

  // Update card 3D tilt hover physics
  connectCardHoverPhysics();

  // Redraw sparkline for primary color update
  renderStarsSparkline();

  // Refresh filters and visible cards
  if (state.repos && state.repos.length > 0) {
    applyFilters();
  }
}

function syncDrawerUI(src) {
  // Sync Experience Mode buttons
  const modeDevBtn = document.getElementById('mode-dev');
  const modeSimpleBtn = document.getElementById('mode-simple');
  if (modeDevBtn && modeSimpleBtn) {
    if (src.userMode === 'non-tech') {
      modeDevBtn.classList.remove('active');
      modeSimpleBtn.classList.add('active');
    } else {
      modeDevBtn.classList.add('active');
      modeSimpleBtn.classList.remove('active');
    }
  }

  // Sync Device Profile buttons
  const profileHighBtn = document.getElementById('profile-high');
  const profileLowBtn = document.getElementById('profile-low');
  if (profileHighBtn && profileLowBtn) {
    if (src.deviceProfile === 'low') {
      profileHighBtn.classList.remove('active');
      profileLowBtn.classList.add('active');
    } else {
      profileHighBtn.classList.add('active');
      profileLowBtn.classList.remove('active');
    }
  }

  // Sync Density Buttons
  document.querySelectorAll('.density-btn[data-density]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.density === src.density);
  });

  // Sync Theme Buttons
  document.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === src.theme);
  });

  // Sync Font Size Buttons
  document.querySelectorAll('[data-fontsize]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fontsize === src.fontSize);
  });
  const fontSizeBadge = document.getElementById('font-size-badge');
  if (fontSizeBadge) {
    fontSizeBadge.textContent = src.fontSize.charAt(0).toUpperCase() + src.fontSize.slice(1);
  }

  // Sync Particles checkbox
  const pCheck = document.getElementById('effects-particles-checkbox');
  if (pCheck) pCheck.checked = src.particlesEnabled;

  // Sync Tilt checkbox
  const tCheck = document.getElementById('effects-tilt-checkbox');
  if (tCheck) tCheck.checked = src.tiltEnabled;

  // Sync Max cards slider
  const slider = document.getElementById('max-cards-slider');
  const sLabel = document.getElementById('max-cards-badge');
  if (slider) {
    slider.value = src.maxVisibleCards;
    if (sLabel) sLabel.textContent = src.maxVisibleCards >= 350 ? 'All' : src.maxVisibleCards;
  }
}

function openSettingsDrawer() {
  const drawer  = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  if (!drawer || !overlay) return;

  // Clone current state into stagedSettings
  stagedSettings = {
    theme: state.theme,
    density: state.density,
    fontSize: state.fontSize,
    maxVisibleCards: state.maxVisibleCards,
    particlesEnabled: state.particlesEnabled,
    tiltEnabled: state.tiltEnabled,
    userMode: state.userMode,
    deviceProfile: state.deviceProfile
  };

  syncDrawerUI(stagedSettings);
  drawer.classList.add('open');
  overlay.classList.add('visible');
  Logger.log('info', 'ui', 'SettingsDrawerOpened');
}

function closeSettingsDrawer() {
  const drawer  = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  if (!drawer || !overlay) return;

  drawer.classList.remove('open');
  overlay.classList.remove('visible');
  
  // Revert all visual styles on page to match current saved state
  applyActiveSettings();
  syncDrawerUI(state);
  Logger.log('info', 'ui', 'SettingsDrawerClosed');
}

function loadSettings() {
  state.theme    = localStorage.getItem(CONFIG_KEYS.THEME)    || 'tokyo-midnight';
  state.density  = localStorage.getItem(CONFIG_KEYS.DENSITY)  || 'comfortable';
  state.fontSize = localStorage.getItem(CONFIG_KEYS.FONT_SIZE) || 'medium';
  state.maxVisibleCards = parseInt(localStorage.getItem(CONFIG_KEYS.MAX_CARDS)) || 350;

  const pVal = localStorage.getItem(CONFIG_KEYS.PARTICLES);
  state.particlesEnabled = pVal !== null ? pVal === 'true' : true;

  const tVal = localStorage.getItem(CONFIG_KEYS.TILT);
  state.tiltEnabled = tVal !== null ? tVal === 'true' : true;

  state.userMode = localStorage.getItem(CONFIG_KEYS.USER_MODE) || 'developer';
  state.deviceProfile = localStorage.getItem(CONFIG_KEYS.DEVICE_PROFILE) || 'high';

  applyActiveSettings();
  syncDrawerUI(state);

  Logger.log('info', 'storage', 'ConfigurationsLoaded', { 
    theme: state.theme, 
    density: state.density, 
    fontSize: state.fontSize,
    particles: state.particlesEnabled,
    tilt: state.tiltEnabled,
    userMode: state.userMode,
    deviceProfile: state.deviceProfile
  });
}

function saveSetting(key, value) {
  localStorage.setItem(key, value);
  Logger.log('info', 'storage', 'ConfigurationSaved', { key, value });
}

/**
 * ============================================================================
 * 5. NETWORK CLIENT
 * ============================================================================
 */
async function fetchData() {
  const t0 = performance.now();
  Logger.log('info', 'network', 'FetchResourcesStarted');
  try {
    const cb = `?t=${Date.now()}`;
    const [reposRes, changelogRes] = await Promise.all([
      fetch(`../repos_output.json${cb}`),
      fetch(`../CHANGELOG.md${cb}`)
    ]);

    if (!reposRes.ok) throw new Error(`repos_output.json: ${reposRes.status} ${reposRes.statusText}`);
    if (!changelogRes.ok) throw new Error(`CHANGELOG.md: ${changelogRes.status} ${changelogRes.statusText}`);

    const reposData = await reposRes.json();
    state.repos = reposData.repos || [];
    state.changelogMarkdown = await changelogRes.text();
    state.generatedAt = reposData.generated_at || null;

    Logger.log('info', 'network', 'FetchResourcesCompleted', { repos: state.repos.length }, Math.round(performance.now() - t0));

    calculateStats(reposData);
    populateLangFilter();
    renderStats();
    renderGrid();
    renderLangStats();
    renderChangelog();
    handleRouting();

    // Fetch live GitHub profile — run after initial render (non-blocking)
    fetchGitHubProfile(reposData.profile || null);

  } catch (err) {
    Logger.log('error', 'network', 'FetchResourcesFailed', { error: err.message }, Math.round(performance.now() - t0));
    throw err;
  }
}

function calculateStats(data) {
  const repos = state.repos;
  const totalStars = repos.reduce((s, r) => s + r.stars, 0);
  const avgStars   = repos.length ? Math.round(totalStars / repos.length) : 0;

  const langCounts = {};
  repos.forEach(r => {
    if (r.language && r.language !== 'Unknown') {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  });

  let topLang = 'N/A', maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) { maxCount = count; topLang = lang; }
  }

  state.stats = { totalStars, totalRepos: repos.length, topLang, avgStars, langCounts };
  Logger.log('info', 'ui', 'StatsCalculated', state.stats);
}

/**
 * ============================================================================
 * 6a. GITHUB PROFILE — REAL-TIME SYNC
 * ============================================================================
 */

/**
 * Fetch profile live from GitHub API with repos_output.json as fallback.
 * Uses the unauthenticated public API (60 req/hr limit — fine for a static site).
 */
async function fetchGitHubProfile(cachedProfile = null) {
  const USERNAME = 'AkashPriyadarshii';
  const t0 = performance.now();
  Logger.log('info', 'profile', 'ProfileFetchStarted');

  let profile = null;

  // ── Try live GitHub API first ──
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.github.com/users/${USERNAME}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
      cache: 'no-cache',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      const remaining = res.headers.get('X-RateLimit-Remaining');
      profile = {
        login:            data.login,
        name:             data.name || data.login,
        bio:              data.bio  || '',
        avatar_url:       data.avatar_url || '',
        html_url:         data.html_url   || `https://github.com/${USERNAME}`,
        company:          data.company    || '',
        blog:             data.blog       || '',
        location:         data.location   || '',
        twitter_username: data.twitter_username || '',
        public_repos:     data.public_repos  || 0,
        followers:        data.followers     || 0,
        following:        data.following     || 0,
        created_at:       data.created_at   || '',
        source:           'live_api',
        rate_remaining:   remaining
      };
      Logger.log('info', 'profile', 'ProfileFetchedLive', { followers: profile.followers, remaining }, Math.round(performance.now() - t0));
    } else {
      throw new Error(`GitHub API ${res.status}`);
    }
  } catch (err) {
    Logger.log('warn', 'profile', 'LiveAPIFailed_UsingCache', { error: err.message });
    // Fall back to cached profile from repos_output.json
    if (cachedProfile) {
      profile = { ...cachedProfile, source: 'cached_json' };
      Logger.log('info', 'profile', 'ProfileRestoredFromCache');
    }
  }

  if (profile) {
    renderProfile(profile);
  } else {
    Logger.log('warn', 'profile', 'NoProfileAvailable');
  }
}

function renderProfile(profile) {
  // ── Avatar ──
  const avatarImg  = document.getElementById('profile-avatar');
  const fallbackIcon = document.getElementById('avatar-fallback-icon');
  if (avatarImg && profile.avatar_url) {
    avatarImg.src = profile.avatar_url;
    avatarImg.onload = () => {
      avatarImg.classList.remove('hidden');
      if (fallbackIcon) fallbackIcon.style.display = 'none';
    };
    avatarImg.onerror = () => {
      avatarImg.classList.add('hidden');
      if (fallbackIcon) fallbackIcon.style.display = '';
    };
  }

  // ── Profile link ──
  const profileLink  = document.getElementById('profile-link');
  const ghProfileLink = document.getElementById('github-profile-link');
  if (profileLink  && profile.html_url) profileLink.href  = profile.html_url;
  if (ghProfileLink && profile.html_url) ghProfileLink.href = profile.html_url;

  // ── Name ──
  const nameEl = document.getElementById('profile-display-name');
  if (nameEl && profile.name) nameEl.textContent = profile.name;

  // ── Bio ──
  const bioEl = document.getElementById('profile-bio');
  if (bioEl && profile.bio) bioEl.textContent = profile.bio;

  // ── Meta row (location, company, blog, twitter) ──
  const metaRow = document.getElementById('profile-meta-row');
  if (metaRow) {
    const items = [];
    if (profile.location) {
      items.push(`<span class="profile-meta-item"><i data-lucide="map-pin"></i>${escapeHTML(profile.location)}</span>`);
    }
    if (profile.company) {
      items.push(`<span class="profile-meta-item"><i data-lucide="building-2"></i>${escapeHTML(profile.company)}</span>`);
    }
    if (profile.blog) {
      const blogUrl = profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`;
      items.push(`<a class="profile-meta-item profile-meta-link" href="${blogUrl}" target="_blank" rel="noopener"><i data-lucide="globe"></i>${escapeHTML(profile.blog.replace(/^https?:\/\//, ''))}</a>`);
    }
    if (profile.twitter_username) {
      items.push(`<a class="profile-meta-item profile-meta-link" href="https://twitter.com/${profile.twitter_username}" target="_blank" rel="noopener"><i data-lucide="twitter"></i>@${escapeHTML(profile.twitter_username)}</a>`);
    }
    metaRow.innerHTML = items.join('');
    lucide.createIcons();
  }

  // ── GitHub Stats Row ──
  const followersEl   = document.getElementById('profile-followers');
  const followingEl   = document.getElementById('profile-following');
  const publicReposEl = document.getElementById('profile-public-repos');
  if (followersEl)   followersEl.textContent   = formatStarNumber(profile.followers || 0);
  if (followingEl)   followingEl.textContent   = formatStarNumber(profile.following || 0);
  if (publicReposEl) publicReposEl.textContent = formatStarNumber(profile.public_repos || 0);

  // ── Sync badge ──
  const syncBadge = document.getElementById('profile-sync-badge');
  if (syncBadge) {
    const isLive = profile.source === 'live_api';
    syncBadge.title = isLive
      ? `Live synced from GitHub API · Rate limit remaining: ${profile.rate_remaining}`
      : `Synced from last workflow run`;
    syncBadge.classList.toggle('sync-live', isLive);
    syncBadge.classList.toggle('sync-cached', !isLive);
    const span = syncBadge.querySelector('span');
    if (span) span.textContent = isLive ? 'Live' : 'Cached';
  }

  // ── Update page <title> & meta description dynamically ──
  if (profile.name) {
    document.title = `${profile.name} | Starred Repos Dashboard`;
  }

  Logger.log('info', 'profile', 'ProfileRendered', { name: profile.name, source: profile.source });
}

/**
 * ============================================================================
 * 6. RENDERING
 * ============================================================================
 */
function renderStats() {
  document.getElementById('stat-total-stars').textContent = formatStarNumber(state.stats.totalStars);
  document.getElementById('stat-total-repos').textContent = state.stats.totalRepos;
  document.getElementById('stat-top-lang').textContent   = state.stats.topLang;
  document.getElementById('stat-avg-stars').textContent  = formatStarNumber(state.stats.avgStars);

  const el = document.getElementById('last-updated-time');
  if (el) el.textContent = formatDateTimeIST(state.generatedAt);
  
  // Render sparkline inside stars card
  renderStarsSparkline();
  
  Logger.log('info', 'ui', 'StatsRendered');
}

function renderGrid() {
  const t0 = performance.now();
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  if (!state.repos.length) {
    grid.innerHTML = `<div class="loading-state"><p>No repositories available.</p></div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  const now  = Date.now();
  const oneDayMs = 86400000;

  state.repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card glass-card';
    card.id = `repo-${repo.rank}`;
    card.setAttribute('role', 'listitem');
    card.setAttribute('data-category', repo.category?.toLowerCase() || 'other');
    card.setAttribute('data-lang',     repo.language?.toLowerCase() || 'unknown');
    card.setAttribute('data-stars',    repo.stars);
    card.setAttribute('data-rank',     repo.rank);
    card.setAttribute('data-name',     repo.full_name.toLowerCase());
    card.setAttribute('data-updated',  repo.last_updated || '');

    const langColor = getLanguageColor(repo.language);
    const cleanedDesc   = cleanReadmeSummary(repo.description || 'No description');
    const escapedDesc   = escapeHTML(cleanedDesc);

    // Trending badge — repos with > 100k stars
    const isTrending = repo.stars >= 100000;
    const trendBadge = isTrending ? `<span class="trending-badge" title="100k+ stars 🔥">🔥 Trending</span>` : '';

    // "Updated Today" badge
    const updatedAt = repo.last_updated ? new Date(repo.last_updated).getTime() : 0;
    const isRecent  = updatedAt && (now - updatedAt) < oneDayMs;
    const recentBadge = isRecent ? `<span class="recent-badge" title="Updated in the last 24h">⚡ Today</span>` : '';

    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-title-group">
          <span class="repo-rank-badge">#${repo.rank}</span>
          <a href="${repo.url}" target="_blank" rel="noopener noreferrer" class="repo-name" aria-label="Open ${repo.full_name} on GitHub">${repo.full_name}</a>
        </div>
        <div class="card-badges-row">
          ${trendBadge}
          ${recentBadge}
          <div class="star-count" title="${repo.stars.toLocaleString()} stars">
            <i data-lucide="star"></i>
            <span>${formatStarNumber(repo.stars)}</span>
          </div>
        </div>
      </div>
      <p class="repo-desc">${escapedDesc}</p>

      <div class="repo-metadata-footer">
        <div class="lang-chip">
          <span class="lang-dot" style="background-color: ${langColor}"></span>
          <span>${repo.language || 'N/A'}</span>
        </div>
        <div class="update-date" title="Last updated">
          <i data-lucide="calendar"></i>
          <span>${formatDateIST(repo.last_updated)}</span>
        </div>
        <div class="card-actions">
          <button class="card-action-btn copy-url-btn" data-url="${repo.url}" title="Copy repo URL" aria-label="Copy URL for ${repo.full_name}">
            <i data-lucide="link"></i>
          </button>
          <button class="card-action-btn share-repo-btn" data-url="${repo.url}" data-name="${repo.full_name}" title="Share repo" aria-label="Share ${repo.full_name}">
            <i data-lucide="share-2"></i>
          </button>
        </div>
      </div>

      <a class="more-info-btn" href="${repo.url}#readme" target="_blank" rel="noopener noreferrer">
        <span>More info</span>
        <i data-lucide="external-link"></i>
      </a>
    `;

    frag.appendChild(card);
  });

  grid.appendChild(frag);
  lucide.createIcons();

  Logger.log('info', 'ui', 'CardsGridPreRendered', { total: state.repos.length }, Math.round(performance.now() - t0));

  connectFoldEvents();
  connectCardActions();
  connectCardHoverPhysics();
  applyFilters();
}

function renderLangStats() {
  const container = document.getElementById('lang-chart-container');
  if (!container) return;

  const langCounts = state.stats.langCounts || {};
  const total = state.repos.length;

  if (!total) {
    container.innerHTML = `<div class="loading-state"><p>No data available.</p></div>`;
    return;
  }

  // Sort by count desc, take top 12
  const sorted = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const maxCount = sorted[0]?.[1] || 1;

  let html = `<div class="lang-bars">`;
  sorted.forEach(([lang, count]) => {
    const pct     = ((count / total) * 100).toFixed(1);
    const barPct  = ((count / maxCount) * 100).toFixed(1);
    const color   = getLanguageColor(lang);
    html += `
      <div class="lang-bar-row interactive-chart-row" data-lang="${escapeHTML(lang)}">
        <div class="lang-bar-label">
          <span class="lang-dot" style="background:${color}"></span>
          <span class="lang-bar-name">${escapeHTML(lang)}</span>
        </div>
        <div class="lang-bar-track">
          <div class="lang-bar-fill" style="width:${barPct}%;background:${color}" title="${count} repos (${pct}%)"></div>
        </div>
        <span class="lang-bar-count">${count} <span class="lang-bar-pct">(${pct}%)</span></span>
      </div>
    `;
  });
  html += `</div>`;

  // Donut chart via conic-gradient
  let conicParts = [];
  let cumulative = 0;
  const COLORS = sorted.map(([lang]) => getLanguageColor(lang));
  sorted.forEach(([, count], i) => {
    const deg = (count / total) * 360;
    conicParts.push(`${COLORS[i]} ${cumulative.toFixed(1)}deg ${(cumulative + deg).toFixed(1)}deg`);
    cumulative += deg;
  });

  html += `
    <div class="lang-donut-wrap">
      <div class="lang-donut" style="background: conic-gradient(${conicParts.join(', ')})">
        <div class="lang-donut-hole">
          <span class="lang-donut-total">${total}</span>
          <span class="lang-donut-label">Repos</span>
        </div>
      </div>
      <div class="lang-donut-legend">
        ${sorted.map(([lang, count], i) => `
          <div class="donut-legend-item interactive-chart-row" data-lang="${escapeHTML(lang)}">
            <span class="lang-dot" style="background:${COLORS[i]}"></span>
            <span>${escapeHTML(lang)}</span>
            <span class="donut-legend-count">${count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Click handler to select and filter by language
  container.querySelectorAll('.interactive-chart-row').forEach(row => {
    row.addEventListener('click', () => {
      const langVal = row.getAttribute('data-lang');
      
      // Update state language filter
      state.activeLang = langVal.toLowerCase();
      
      // Sync dropdown select element
      const selectEl = document.getElementById('lang-filter-select');
      if (selectEl) selectEl.value = state.activeLang;

      // Navigate to grid and refresh filter
      setRoute('grid');
      applyFilters();

      showToast(`🔍 Filtering repositories by ${langVal}`, 'info');
    });
  });

  Logger.log('info', 'ui', 'LangStatsRendered', { languages: sorted.length });
}

// ─── Changelog ────────────────────────────────────────────────────────────────
function parseChangelog(markdown) {
  const entries = [];
  const sections = markdown.split(/\n+---\n+/);

  sections.forEach(section => {
    const headerMatch = section.match(/##\s+\[(.*?)\]/);
    if (!headerMatch) return;
    const dateStr = headerMatch[1];

    const addedSection   = section.split(/###\s+➕\s+Added/)[1]?.split(/###/)[0];
    const removedSection = section.split(/###\s+➖\s+Removed/)[1]?.split(/###/)[0];

    const addedRepos = [];
    if (addedSection) {
      addedSection.split('\n').forEach(line => {
        const m = line.match(/-\s+\*\*\[(.*?)\]\((.*?)\)\*\*\s+\((.*?)⭐\)\s+-\s+(.*)/);
        if (m) addedRepos.push({ name: m[1], url: m[2], stars: m[3], description: m[4] });
      });
    }

    const removedRepos = [];
    if (removedSection) {
      removedSection.split('\n').forEach(line => {
        const m = line.match(/-\s+(.*)/);
        if (m && m[1].trim()) removedRepos.push(m[1].trim());
      });
    }

    const statsMatch = section.match(/\*\*Total Repositories:\*\*\s+(\d+)\s+\((.*?)\)/);
    entries.push({
      dateStr,
      added:   addedRepos,
      removed: removedRepos,
      totalRepos: statsMatch?.[1] || null,
      diff: statsMatch?.[2] || null
    });
  });

  return entries;
}

function renderTimeline(entries) {
  let html = `
    <div class="changelog-header-placeholder">
      <h2>📜 Starred Repos Changelog</h2>
      <p>Track history of starred and unstarred repositories.</p>
      <hr class="section-divider">
    </div>
    <div class="timeline">
  `;

  entries.forEach((entry, idx) => {
    let addedHtml = '';
    if (entry.added.length) {
      addedHtml = `
        <div class="timeline-sub-section added">
          <h4><i data-lucide="plus-circle"></i> Added (${entry.added.length})</h4>
          <ul class="timeline-repo-list">
            ${entry.added.map(r => `
              <li>
                <div class="timeline-repo-header">
                  <a href="${r.url}" target="_blank" rel="noopener" class="timeline-repo-name">${r.name}</a>
                  <span class="timeline-repo-stars"><i data-lucide="star"></i> ${r.stars}</span>
                </div>
                <p class="timeline-repo-desc">${escapeHTML(r.description)}</p>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    let removedHtml = '';
    if (entry.removed.length) {
      removedHtml = `
        <div class="timeline-sub-section removed">
          <h4><i data-lucide="minus-circle"></i> Removed (${entry.removed.length})</h4>
          <ul class="timeline-removed-list">
            ${entry.removed.map(n => `<li>${n}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    html += `
      <div class="timeline-item glass-card" style="animation-delay:${idx * 0.05}s">
        <div class="timeline-badge"><i data-lucide="git-commit"></i></div>
        <div class="timeline-panel">
          <div class="timeline-meta">
            <span class="timeline-date"><i data-lucide="clock"></i> ${entry.dateStr}</span>
            ${entry.diff ? `<span class="timeline-diff-badge">${entry.diff}</span>` : ''}
          </div>
          <div class="timeline-body">${addedHtml}${removedHtml}</div>
          ${entry.totalRepos ? `<div class="timeline-footer"><span>Total: <strong>${entry.totalRepos}</strong> repos</span></div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

function renderChangelog() {
  const el = document.getElementById('changelog-markdown');
  try {
    if (!state.changelogMarkdown?.includes('## [')) {
      el.innerHTML = `
        <div class="changelog-header-placeholder">
          <h2>📜 Starred Repos Changelog</h2>
          <p>Track history of starred and unstarred repositories.</p>
          <hr class="section-divider">
        </div>
        <div class="empty-changelog-card glass-card">
          <div class="empty-icon-wrapper"><i data-lucide="info"></i></div>
          <h3>No Updates Yet</h3>
          <p>Once you add or remove stars, the automated daily updates will log changes here.</p>
        </div>
      `;
      lucide.createIcons();
      Logger.log('info', 'ui', 'ChangelogEmptyState');
      return;
    }
    const entries = parseChangelog(state.changelogMarkdown);
    el.innerHTML = renderTimeline(entries);
    lucide.createIcons();
    Logger.log('info', 'ui', 'ChangelogRendered', { entries: entries.length });
  } catch (err) {
    Logger.log('error', 'ui', 'ChangelogRenderFailed', { error: err.message });
    el.innerHTML = `<div class="loading-state"><p class="error-text">Failed to parse changelog.</p></div>`;
  }
}

/**
 * ============================================================================
 * 7. FILTERS, SORT, LANGUAGE FILTER
 * ============================================================================
 */
function populateLangFilter() {
  const select = document.getElementById('lang-filter-select');
  if (!select) return;

  const langs = Object.keys(state.stats.langCounts || {}).sort();
  langs.forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang.toLowerCase();
    opt.textContent = lang;
    select.appendChild(opt);
  });
}

function highlightText(text, query) {
  if (!text || !query) return text;
  const escaped = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="neon-highlight">$1</mark>');
}

function applyFilters() {
  const t0 = performance.now();
  const cards = document.querySelectorAll('.repo-card');
  const grid  = document.getElementById('cards-grid');
  const matches = [];

  cards.forEach(card => {
    const rank = parseInt(card.getAttribute('data-rank'));
    const repo = state.repos.find(r => r.rank === rank);
    if (!repo) return;

    let isMatch = true;

    // Category filter
    if (state.activeCategory !== 'all') {
      const kwMap = {
        'ai agents':        ['agent', 'openclaw', 'codex', 'claude', 'hermes', 'claw', 'opencode', 'grok'],
        'web automation':   ['crawl', 'scrape', 'browser', 'selenium', 'playwright', 'puppeteer', 'firecrawl'],
        'llm infrastructure': ['mem', 'rag', 'llm', 'memory', 'knowledge', 'vector', 'embedding'],
        'dev tools':        ['editor', 'ide', 'git', 'code', 'cli', 'terminal', 'debug', 'linter'],
        'infrastructure':   ['docker', 'devops', 'k8s', 'infra', 'deploy', 'podman', 'terraform']
      };
      const kws  = kwMap[state.activeCategory] || [];
      const text = `${repo.full_name} ${repo.description} ${repo.language}`.toLowerCase();
      if (!kws.some(k => text.includes(k))) isMatch = false;
    }

    // Language filter
    if (isMatch && state.activeLang !== 'all') {
      const repoLang = (repo.language || '').toLowerCase();
      if (repoLang !== state.activeLang) isMatch = false;
    }

    // Search query
    if (isMatch && state.searchQuery) {
      const haystack = `${repo.full_name} ${repo.description || ''} ${repo.language || ''} ${repo.readme_summary || ''}`.toLowerCase();
      if (!haystack.includes(state.searchQuery)) isMatch = false;
    }

    // Apply highlight or clear
    const nameEl   = card.querySelector('.repo-name');
    const descEl   = card.querySelector('.repo-desc');

    if (isMatch) {
      matches.push({ card, repo });
      const cleanedDesc   = cleanReadmeSummary(repo.description || '');
      if (state.searchQuery) {
        if (nameEl)   nameEl.innerHTML   = highlightText(escapeHTML(repo.full_name), state.searchQuery);
        if (descEl)   descEl.innerHTML   = highlightText(escapeHTML(cleanedDesc), state.searchQuery);
      } else {
        if (nameEl)   nameEl.innerHTML   = escapeHTML(repo.full_name);
        if (descEl)   descEl.innerHTML   = escapeHTML(cleanedDesc || 'No description');
      }
    } else {
      card.classList.add('hidden');
    }
  });

  // Sort
  matches.sort((a, b) => {
    switch (state.activeSort) {
      case 'stars-desc':   return b.repo.stars - a.repo.stars;
      case 'stars-asc':    return a.repo.stars - b.repo.stars;
      case 'rank-asc':     return a.repo.rank  - b.repo.rank;
      case 'name-asc':     return a.repo.full_name.localeCompare(b.repo.full_name);
      case 'updated-desc': {
        const ta = a.repo.last_updated ? new Date(a.repo.last_updated).getTime() : 0;
        const tb = b.repo.last_updated ? new Date(b.repo.last_updated).getTime() : 0;
        return tb - ta;
      }
      default: return 0;
    }
  });

  // Render order + visibility
  let shown = 0;
  matches.forEach((item, i) => {
    if (i < state.maxVisibleCards) {
      item.card.classList.remove('hidden');
      item.card.style.order = i;
      item.card.style.animationDelay = i < 30 ? `${i * 0.03}s` : '0s';
      shown++;
    } else {
      item.card.classList.add('hidden');
    }
  });

  // Result count badge
  const badge = document.getElementById('result-count-badge');
  if (badge) badge.textContent = `${shown} of ${state.repos.length} repos`;

  // Empty state
  let emptyMsg = document.getElementById('grid-empty-message');
  if (shown === 0) {
    if (!emptyMsg) {
      emptyMsg = document.createElement('div');
      emptyMsg.id = 'grid-empty-message';
      emptyMsg.className = 'loading-state';
      emptyMsg.innerHTML = `<p>No repositories match your criteria. Try clearing filters.</p>`;
      grid.appendChild(emptyMsg);
    }
  } else {
    emptyMsg?.remove();
  }

  // Update shareable URL hash
  updateShareableHash();

  Logger.log('info', 'ui', 'FiltersApplied', { shown, total: state.repos.length }, Math.round(performance.now() - t0));
}

/**
 * ============================================================================
 * 8. UI INIT & EVENT BINDINGS
 * ============================================================================
 */
function initUI() {
  Logger.setUIConsole(document.getElementById('log-console'));

  // ── Tab Navigation ──
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => setRoute(tab.dataset.tab));
  });

  // ── Settings Drawer ──
  const overlay = document.getElementById('settings-overlay');
  document.getElementById('settings-toggle-btn')?.addEventListener('click', openSettingsDrawer);
  document.getElementById('settings-close-btn')?.addEventListener('click', closeSettingsDrawer);
  overlay?.addEventListener('click', closeSettingsDrawer);

  // ── Apply Settings Button ──
  document.getElementById('apply-settings-btn')?.addEventListener('click', () => {
    // Copy staged settings back to state
    state.theme = stagedSettings.theme;
    state.density = stagedSettings.density;
    state.fontSize = stagedSettings.fontSize;
    state.maxVisibleCards = stagedSettings.maxVisibleCards;
    state.particlesEnabled = stagedSettings.particlesEnabled;
    state.tiltEnabled = stagedSettings.tiltEnabled;
    state.userMode = stagedSettings.userMode;
    state.deviceProfile = stagedSettings.deviceProfile;

    // Save settings to LocalStorage
    saveSetting(CONFIG_KEYS.THEME, state.theme);
    saveSetting(CONFIG_KEYS.DENSITY, state.density);
    saveSetting(CONFIG_KEYS.FONT_SIZE, state.fontSize);
    saveSetting(CONFIG_KEYS.MAX_CARDS, state.maxVisibleCards);
    saveSetting(CONFIG_KEYS.PARTICLES, state.particlesEnabled);
    saveSetting(CONFIG_KEYS.TILT, state.tiltEnabled);
    saveSetting(CONFIG_KEYS.USER_MODE, state.userMode);
    saveSetting(CONFIG_KEYS.DEVICE_PROFILE, state.deviceProfile);

    // Apply active settings to page
    applyActiveSettings();

    // Close settings drawer
    closeSettingsDrawer();

    // Toast success
    showToast('✨ Dashboard settings applied successfully!', 'success');
    Logger.log('info', 'ui', 'SettingsAppliedPermanently');
  });

  // ── Experience Mode Buttons ──
  const modeDevBtn = document.getElementById('mode-dev');
  const modeSimpleBtn = document.getElementById('mode-simple');
  if (modeDevBtn && modeSimpleBtn) {
    modeDevBtn.addEventListener('click', () => {
      modeDevBtn.classList.add('active');
      modeSimpleBtn.classList.remove('active');
      stagedSettings.userMode = 'developer';
      document.body.classList.remove('non-tech-mode');
      Logger.log('info', 'ui', 'UserModePreview', { mode: 'developer' });
    });
    modeSimpleBtn.addEventListener('click', () => {
      modeDevBtn.classList.remove('active');
      modeSimpleBtn.classList.add('active');
      stagedSettings.userMode = 'non-tech';
      document.body.classList.add('non-tech-mode');
      Logger.log('info', 'ui', 'UserModePreview', { mode: 'non-tech' });
    });
  }

  // ── Device Profile Buttons ──
  const profileHighBtn = document.getElementById('profile-high');
  const profileLowBtn = document.getElementById('profile-low');
  if (profileHighBtn && profileLowBtn) {
    profileHighBtn.addEventListener('click', () => {
      profileHighBtn.classList.add('active');
      profileLowBtn.classList.remove('active');
      stagedSettings.deviceProfile = 'high';
      stagedSettings.particlesEnabled = true;
      stagedSettings.tiltEnabled = true;
      stagedSettings.maxVisibleCards = 350;

      document.body.classList.remove('low-end-device');

      // Sync checkbox UI
      const pCheck = document.getElementById('effects-particles-checkbox');
      const tCheck = document.getElementById('effects-tilt-checkbox');
      if (pCheck) pCheck.checked = true;
      if (tCheck) tCheck.checked = true;

      // Sync slider UI
      const slider = document.getElementById('max-cards-slider');
      const sLabel = document.getElementById('max-cards-badge');
      if (slider) {
        slider.value = 350;
        if (sLabel) sLabel.textContent = 'All';
      }

      if (particleBgInstance) {
        particleBgInstance.setActive(true);
      }
      connectCardHoverPhysics();
      if (state.repos && state.repos.length > 0) {
        applyFilters();
      }

      Logger.log('info', 'ui', 'DeviceProfilePreview', { profile: 'high' });
    });

    profileLowBtn.addEventListener('click', () => {
      profileHighBtn.classList.remove('active');
      profileLowBtn.classList.add('active');
      stagedSettings.deviceProfile = 'low';
      stagedSettings.particlesEnabled = false;
      stagedSettings.tiltEnabled = false;
      stagedSettings.maxVisibleCards = Math.min(stagedSettings.maxVisibleCards, 50);

      document.body.classList.add('low-end-device');

      // Sync checkbox UI
      const pCheck = document.getElementById('effects-particles-checkbox');
      const tCheck = document.getElementById('effects-tilt-checkbox');
      if (pCheck) pCheck.checked = false;
      if (tCheck) tCheck.checked = false;

      // Sync slider UI
      const slider = document.getElementById('max-cards-slider');
      const sLabel = document.getElementById('max-cards-badge');
      if (slider) {
        slider.value = stagedSettings.maxVisibleCards;
        if (sLabel) sLabel.textContent = stagedSettings.maxVisibleCards;
      }

      if (particleBgInstance) {
        particleBgInstance.setActive(false);
      }
      connectCardHoverPhysics();
      if (state.repos && state.repos.length > 0) {
        applyFilters();
      }

      Logger.log('info', 'ui', 'DeviceProfilePreview', { profile: 'low' });
    });
  }

  // ── Density Buttons ──
  document.querySelectorAll('.density-btn[data-density]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.density-btn[data-density]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stagedSettings.density = btn.dataset.density;
      document.documentElement.setAttribute('data-density', stagedSettings.density);
      Logger.log('info', 'ui', 'DensityPreview', { density: stagedSettings.density });
    });
  });

  // ── Theme Buttons ──
  document.querySelectorAll('.theme-btn[data-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn[data-theme]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stagedSettings.theme = btn.dataset.theme;
      document.documentElement.setAttribute('data-theme', stagedSettings.theme);
      
      // Update canvas background colors dynamically for preview
      if (particleBgInstance) {
        particleBgInstance.init();
      }
      renderStarsSparkline();

      Logger.log('info', 'ui', 'ThemePreview', { theme: stagedSettings.theme });
    });
  });

  // ── Visual Effects Toggles ──
  const particlesCheckbox = document.getElementById('effects-particles-checkbox');
  if (particlesCheckbox) {
    particlesCheckbox.addEventListener('change', e => {
      stagedSettings.particlesEnabled = e.target.checked;
      if (particleBgInstance) {
        particleBgInstance.setActive(stagedSettings.particlesEnabled && stagedSettings.deviceProfile !== 'low');
      }
      Logger.log('info', 'ui', 'ParticlesTogglePreview', { enabled: stagedSettings.particlesEnabled });
    });
  }

  const tiltCheckbox = document.getElementById('effects-tilt-checkbox');
  if (tiltCheckbox) {
    tiltCheckbox.addEventListener('change', e => {
      stagedSettings.tiltEnabled = e.target.checked;
      const oldTilt = state.tiltEnabled;
      state.tiltEnabled = stagedSettings.tiltEnabled;
      connectCardHoverPhysics();
      state.tiltEnabled = oldTilt;
      Logger.log('info', 'ui', 'TiltTogglePreview', { enabled: stagedSettings.tiltEnabled });
    });
  }

  // ── Font Size Buttons ──
  document.querySelectorAll('[data-fontsize]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-fontsize]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      stagedSettings.fontSize = btn.dataset.fontsize;
      document.documentElement.setAttribute('data-fontsize', stagedSettings.fontSize);
      const badge = document.getElementById('font-size-badge');
      if (badge) badge.textContent = stagedSettings.fontSize.charAt(0).toUpperCase() + stagedSettings.fontSize.slice(1);
      Logger.log('info', 'ui', 'FontSizePreview', { fontSize: stagedSettings.fontSize });
    });
  });

  // ── Max Cards Slider ──
  const slider = document.getElementById('max-cards-slider');
  const sLabel = document.getElementById('max-cards-badge');
  if (slider) {
    slider.addEventListener('input', e => {
      const v = parseInt(e.target.value);
      stagedSettings.maxVisibleCards = v;
      if (sLabel) sLabel.textContent = v >= 350 ? 'All' : v;
      
      const oldMax = state.maxVisibleCards;
      state.maxVisibleCards = v;
      if (state.repos && state.repos.length > 0) {
        applyFilters();
      }
      state.maxVisibleCards = oldMax;

      Logger.log('info', 'ui', 'MaxCardsPreview', { maxCards: v });
    });
  }

  // ── Log Download ──
  document.getElementById('log-download-btn')?.addEventListener('click', () => Logger.downloadLogs());

  // ── Sort Selector ──
  document.getElementById('sort-select')?.addEventListener('change', e => {
    state.activeSort = e.target.value;
    applyFilters();
  });

  // ── Category Tabs ──
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.category-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      state.activeCategory = tab.dataset.category;
      applyFilters();
    });
  });

  // ── Language Filter ──
  document.getElementById('lang-filter-select')?.addEventListener('change', e => {
    state.activeLang = e.target.value;
    applyFilters();
    Logger.log('info', 'ui', 'LangFilterChanged', { lang: state.activeLang });
  });

  // ── Search ──
  const searchInput    = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('search-clear-btn');
  let debounce = null;

  searchInput?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    clearSearchBtn?.classList.toggle('hidden', !q);
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.searchQuery = q;
      applyFilters();
    }, 150);
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    applyFilters();
  });

  // ── Share Button (header) ──
  document.getElementById('share-btn')?.addEventListener('click', shareDashboard);

  // ── Routing ──
  window.addEventListener('hashchange', handleRouting);

  // ── Shortcuts Modal ──
  document.getElementById('shortcuts-close-btn')?.addEventListener('click', () => {
    document.getElementById('shortcuts-modal')?.classList.add('hidden');
  });
}

// ── Card fold toggles ──
function connectFoldEvents() {}

// ── Per-card copy & share buttons ──
function connectCardActions() {
  document.querySelectorAll('.copy-url-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const url = btn.dataset.url;
      copyToClipboard(url, `Copied ${url}`);
    });
  });

  document.querySelectorAll('.share-repo-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { url, name } = btn.dataset;
      if (navigator.share) {
        navigator.share({ title: name, url }).catch(() => {});
      } else {
        copyToClipboard(url, `Link copied for ${name}`);
      }
    });
  });
}

// ── Card 3D Tilt Hover & Cursor Follow Glow ──
function connectCardHoverPhysics() {
  const cards = document.querySelectorAll('.repo-card');
  const isHoverSupported = window.matchMedia('(hover: hover)').matches;

  cards.forEach(card => {
    // Reset layout transforms
    card.style.transform = '';
    card.removeEventListener('mousemove', handleCardMouseMove);
    card.removeEventListener('mouseleave', handleCardMouseLeave);

    if (!state.tiltEnabled || !isHoverSupported) {
      return;
    }

    card.addEventListener('mousemove', handleCardMouseMove);
    card.addEventListener('mouseleave', handleCardMouseLeave);
  });
}

function handleCardMouseMove(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  card.style.setProperty('--mouse-x', `${x}px`);
  card.style.setProperty('--mouse-y', `${y}px`);

  const tiltX = ((y / rect.height) - 0.5) * -12;
  const tiltY = ((x / rect.width) - 0.5) * 12;

  card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px) scale(1.02)`;
}

function handleCardMouseLeave(e) {
  const card = e.currentTarget;
  card.style.transform = '';
}

/**
 * ============================================================================
 * 9. SCROLL TO TOP FAB
 * ============================================================================
 */
function initScrollToTop() {
  const btn = document.getElementById('scroll-top-btn');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('hidden', window.scrollY < 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * ============================================================================
 * 10. KEYBOARD SHORTCUTS
 * ============================================================================
 */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const active = document.activeElement;
    const isTyping = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT';

    // Always-active shortcuts
    if (e.key === 'Escape') {
      // Close modals / clear search
      document.getElementById('shortcuts-modal')?.classList.add('hidden');
      closeSettingsDrawer();
      if (state.searchQuery) {
        const si = document.getElementById('search-input');
        if (si) si.value = '';
        state.searchQuery = '';
        document.getElementById('search-clear-btn')?.classList.add('hidden');
        applyFilters();
      }
      return;
    }

    if (isTyping) return; // Don't interfere with typing

    switch (e.key) {
      case '/':
        e.preventDefault();
        document.getElementById('search-input')?.focus();
        break;
      case '?':
        document.getElementById('shortcuts-modal')?.classList.toggle('hidden');
        break;
      case 'g': case 'G':
        setRoute('grid');
        break;
      case 's': case 'S':
        setRoute('stats');
        break;
      case 'c': case 'C':
        setRoute('changelog');
        break;
      case 't': case 'T':
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'i': case 'I':
        triggerInstall();
        break;
    }
  });
}

/**
 * ============================================================================
 * 11. ROUTING
 * ============================================================================
 */
function setRoute(tab) {
  window.location.hash = `view=${tab}`;
}

function handleRouting() {
  const hash  = window.location.hash || '#view=grid';
  const match = hash.match(/#view=(\w+)/);
  const active = match?.[1] || 'grid';

  document.querySelectorAll('.tab-view').forEach(v => {
    v.classList.toggle('active', v.id === `view-${active}`);
  });
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === active);
  });

  // Restore search/filter from hash params
  restoreFiltersFromHash(hash);

  Logger.log('info', 'ui', 'RouteChanged', { view: active });
}

function updateShareableHash() {
  const current = window.location.hash.split('?')[0];
  const params  = [];
  if (state.searchQuery)         params.push(`q=${encodeURIComponent(state.searchQuery)}`);
  if (state.activeCategory !== 'all') params.push(`cat=${encodeURIComponent(state.activeCategory)}`);
  if (state.activeLang !== 'all')     params.push(`lang=${encodeURIComponent(state.activeLang)}`);
  if (state.activeSort !== 'stars-desc') params.push(`sort=${state.activeSort}`);
  const newHash = params.length ? `${current}?${params.join('&')}` : current;
  if (newHash !== window.location.hash) {
    history.replaceState(null, '', newHash);
  }
}

function restoreFiltersFromHash(hash) {
  const qPart = hash.split('?')[1];
  if (!qPart) return;
  const params = new URLSearchParams(qPart);

  if (params.has('q')) {
    state.searchQuery = params.get('q');
    const si = document.getElementById('search-input');
    if (si) si.value = state.searchQuery;
  }
  if (params.has('cat')) state.activeCategory = params.get('cat');
  if (params.has('lang')) state.activeLang = params.get('lang');
  if (params.has('sort')) state.activeSort = params.get('sort');
}

/**
 * ============================================================================
 * 12. SHARE DASHBOARD
 * ============================================================================
 */
async function shareDashboard() {
  const url   = window.location.href;
  const title = 'AkashPriyadarshii — Starred Repos Dashboard';
  const text  = `Check out this curated collection of ${state.repos.length}+ GitHub starred repos!`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      Logger.log('info', 'ui', 'DashboardShared');
    } catch (err) {
      if (err.name !== 'AbortError') copyToClipboard(url, 'Link copied to clipboard!');
    }
  } else {
    copyToClipboard(url, 'Link copied to clipboard!');
  }
}

/**
 * ============================================================================
 * 13. TOAST NOTIFICATION SYSTEM
 * ============================================================================
 */
function showToast(message, type = 'info', durationMs = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, durationMs);
}

async function copyToClipboard(text, successMsg = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
    Logger.log('info', 'ui', 'CopiedToClipboard', { text: text.slice(0, 50) });
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg, 'success');
  }
}

/**
 * ============================================================================
 * 14. FORMATTING — ALL IN IST
 * ============================================================================
 */

/**
 * Convert any UTC ISO string → IST datetime string
 * e.g. "May 25, 2026 18:27 IST"
 */
function formatDateTimeIST(isoString) {
  if (!isoString || isoString === 'Unknown') return 'N/A';
  try {
    const utcMs  = new Date(isoString).getTime();
    const istMs  = utcMs + IST_OFFSET_MS;
    const d      = new Date(istMs);

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const day    = String(d.getUTCDate()).padStart(2, '0');
    const month  = months[d.getUTCMonth()];
    const year   = d.getUTCFullYear();
    const hh     = String(d.getUTCHours()).padStart(2, '0');
    const mm     = String(d.getUTCMinutes()).padStart(2, '0');

    return `${month} ${day}, ${year} ${hh}:${mm} IST`;
  } catch {
    return 'N/A';
  }
}

/**
 * Short date in IST — "May 25, 2026"
 */
function formatDateIST(isoString) {
  if (!isoString || isoString === 'Unknown') return 'N/A';
  try {
    const utcMs = new Date(isoString).getTime();
    const d     = new Date(utcMs + IST_OFFSET_MS);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
  } catch {
    return 'N/A';
  }
}

function formatStarNumber(num) {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'k';
  return String(num);
}

/**
 * ============================================================================
 * 15. UTILITIES
 * ============================================================================
 */
function getLanguageColor(lang) {
  const colors = {
    TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
    Rust: '#dee5e6',       Go: '#00ADD8',         Shell: '#89e051',
    Kotlin: '#A97BFF',     Java: '#b07219',        'C++': '#f34b7d',
    C: '#555555',          Swift: '#F05138',       Dart: '#00B4AB',
    HTML: '#e34c26',       CSS: '#563d7c',         PHP: '#777bb3',
    Ruby: '#701516',       Clojure: '#db5855',     Zig: '#ec915c',
    MDX: '#fcb32c',        'C#': '#178600',        Elixir: '#6e4a7e'
  };
  return colors[lang] || '#8b949e';
}

/**
 * Clean README summary from raw HTML tags, image tags, links, and markdown formatting.
 */
function cleanReadmeSummary(text) {
  if (!text) return '';
  let clean = text;

  // Remove HTML comments (even if truncated)
  clean = clean.replace(/<!--[\s\S]*?(?:-->|$)/g, '');

  // Remove all HTML tags (complete or truncated)
  // Matches '<' followed by any characters except '>' until a '>' or the end of the string
  clean = clean.replace(/<[^>]*(?:>|$)/gi, ' ');

  // Clean Markdown images: ![alt](url) (even if truncated)
  clean = clean.replace(/!\[([^\]]*)\]\([^)]*(?:\)|$)/g, '');

  // Clean Markdown links: [text](url) (even if truncated)
  clean = clean.replace(/\[([^\]]+)\]\([^)]*(?:\)|$)/g, '$1');

  // Clean standalone brackets keeping inner text
  clean = clean.replace(/\[([^\]]+)\]/g, '$1');

  // Clean Markdown code blocks and inline code
  clean = clean.replace(/```[\s\S]*?(?:```|$)/g, '');
  clean = clean.replace(/`([^`]+)`?/g, '$1');

  // Clean Markdown bold/italic styles
  clean = clean.replace(/(\*\*|__)(.*?)\1/g, '$2');
  clean = clean.replace(/(\*|_)(.*?)\1/g, '$2');
  clean = clean.replace(/~~(.*?)~~/g, '$1');

  // Clean headings and lists
  clean = clean.replace(/^#+\s+/gm, '');
  clean = clean.replace(/^>\s+/gm, '');
  clean = clean.replace(/^[-*+]\s+/gm, '');
  clean = clean.replace(/^\d+\.\s+/gm, '');

  // Replace common HTML entities with their plaintext equivalents
  clean = clean.replace(/&nbsp;/gi, ' ')
               .replace(/&amp;/gi, '&')
               .replace(/&lt;/gi, '<')
               .replace(/&gt;/gi, '>')
               .replace(/&quot;/gi, '"')
               .replace(/&#039;/gi, "'")
               .replace(/&#39;/gi, "'");

  // Normalize line endings and whitespace
  clean = clean.replace(/\r?\n/g, ' ');
  clean = clean.replace(/\s+/g, ' ');

  return clean.trim();
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showErrorOverlay(msg) {
  const overlay  = document.getElementById('error-overlay');
  const msgEl    = document.getElementById('error-message');
  if (overlay && msgEl) {
    msgEl.textContent = msg;
    overlay.classList.remove('hidden');
  }
}

/**
 * ============================================================================
 * Constellation Background Canvas particle system
 * ============================================================================
 */
class ConstellationBackground {
  constructor() {
    this.canvas = document.getElementById('canvas-particles');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationFrameId = null;
    this.maxParticles = 75;
    this.connectionDistance = 110;
    this.active = true;
    this.mouse = { x: null, y: null, radius: 150 };

    this.init();
    this.bindEvents();
    this.start();
  }

  init() {
    if (!this.canvas) return;
    this.resizeCanvas();
    this.particles = [];
    const color = this.getThemeColor();
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        color: color
      });
    }
  }

  getThemeColor() {
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
    return primaryColor || '#3B82F6';
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.init();
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mouseout', () => {
      this.mouse.x = null;
      this.mouse.y = null;
    });
  }

  update() {
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || 
                     document.body.classList.contains('body-reduced-motion');
    if (isReduced || !this.active) return;

    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      if (this.mouse.x !== null && this.mouse.y !== null) {
        const dx = p.x - this.mouse.x;
        const dy = p.y - this.mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.mouse.radius) {
          const force = (this.mouse.radius - dist) / this.mouse.radius;
          p.x += (dx / dist) * force * 1.0;
          p.y += (dy / dist) * force * 1.0;
        }
      }
    });
  }

  draw() {
    if (!this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || 
                     document.body.classList.contains('body-reduced-motion');
    if (isReduced || !this.active) return;

    const color = this.getThemeColor();

    this.particles.forEach((p, idx) => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.22;
      this.ctx.fill();

      for (let j = idx + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.connectionDistance) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = color;
          this.ctx.globalAlpha = (1 - dist / this.connectionDistance) * 0.12;
          this.ctx.lineWidth = 0.8;
          this.ctx.stroke();
        }
      }
    });
    this.ctx.globalAlpha = 1.0;
  }

  start() {
    const loop = () => {
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  setActive(stateVal) {
    this.active = stateVal;
    if (!stateVal) {
      if (this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    } else {
      this.init();
    }
  }
}

/**
 * ============================================================================
 * SVG Sparkline inside stars bento card
 * ============================================================================
 */
function renderStarsSparkline() {
  const container = document.getElementById('stars-sparkline');
  if (!container || !state.repos.length) return;

  const sample = state.repos.slice(0, 15).map(r => r.stars).reverse();
  const max = Math.max(...sample);
  const min = Math.min(...sample);
  const range = max - min || 1;

  const width = container.clientWidth || 300;
  const height = container.clientHeight || 35;

  const points = sample.map((val, index) => {
    const x = (index / (sample.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#3B82F6';

  const svg = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="display:block; overflow:visible;">
      <defs>
        <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${primaryColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="M 0,${height} L ${points.join(' L ')} L ${width},${height} Z" fill="url(#sparkline-grad)"></path>
      <polyline points="${points.join(' ')}" fill="none" stroke="${primaryColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
    </svg>
  `;
  container.innerHTML = svg;
}

window.addEventListener('resize', () => {
  renderStarsSparkline();
});
