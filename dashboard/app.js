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
    
    // Maintain circular buffer constraint (max 500 items)
    if (this.logs.length > this.bufferSize) {
      this.logs.shift();
    }

    this.appendLogToUI(entry);
    
    // Print to developer tools console
    const consoleMsg = `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.event} ${payload ? JSON.stringify(payload) : ''} (${durationMs}ms)`;
    if (level === 'error' || level === 'fatal') {
      console.error(consoleMsg);
    } else if (level === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }
  }

  appendLogToUI(entry) {
    if (!this.uiConsole) return;

    const entryDiv = document.createElement('div');
    entryDiv.className = `log-entry level-${entry.level}`;
    entryDiv.textContent = `[${entry.timestamp.split('T')[1].slice(0, 8)}] [${entry.level}] [${entry.module}] ${entry.event} ${entry.payload ? JSON.stringify(entry.payload) : ''}`;
    
    this.uiConsole.appendChild(entryDiv);
    this.uiConsole.scrollTop = this.uiConsole.scrollHeight;
  }

  flushToConsole() {
    if (!this.uiConsole) return;
    this.uiConsole.innerHTML = '';
    this.logs.forEach(entry => this.appendLogToUI(entry));
  }

  downloadLogs() {
    this.log('info', 'storage', 'ExportingLogsStarted');
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.logs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `starred_repos_diagnostics_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.log('info', 'storage', 'ExportingLogsCompleted');
    } catch (err) {
      this.log('error', 'storage', 'ExportingLogsFailed', { error: err.message });
    }
  }
}

// Instantiate Global Logger Singleton
const Logger = new AppLogger();

/**
 * ============================================================================
 * 2. DATA UTILITIES & STATE STORAGE
 * ============================================================================
 */
const CONFIG_KEYS = {
  THEME: 'starred_repos_theme',
  DENSITY: 'starred_repos_density',
  MAX_CARDS: 'starred_repos_max_cards'
};

const state = {
  repos: [],
  changelogMarkdown: '',
  stats: {},
  activeCategory: 'all',
  activeSort: 'stars-desc',
  searchQuery: '',
  maxVisibleCards: 350,
  density: 'comfortable',
  theme: 'dark'
};

/**
 * ============================================================================
 * 3. CORE APPLICATION LOGIC
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  const startTime = performance.now();
  Logger.log('info', 'ui', 'AppInitializationStarted');

  // Load Saved Configurations
  loadSettings();
  
  // Initialize UI Selectors and Listeners
  initUI();
  
  // Fetch External Repos JSON & Changelog md Concurrently
  fetchData().then(() => {
    Logger.log('info', 'ui', 'AppInitializationCompleted', null, Math.round(performance.now() - startTime));
  }).catch(err => {
    Logger.log('fatal', 'ui', 'AppInitializationFailed', { error: err.message }, Math.round(performance.now() - startTime));
    showErrorOverlay(err.message);
  });
});

function loadSettings() {
  state.theme = localStorage.getItem(CONFIG_KEYS.THEME) || 'dark';
  state.density = localStorage.getItem(CONFIG_KEYS.DENSITY) || 'comfortable';
  state.maxVisibleCards = parseInt(localStorage.getItem(CONFIG_KEYS.MAX_CARDS)) || 350;

  // Apply properties to HTML element
  document.documentElement.setAttribute('data-theme', state.theme);
  document.documentElement.setAttribute('data-density', state.density);
  
  Logger.log('info', 'storage', 'ConfigurationsLoaded', { theme: state.theme, density: state.density, maxCards: state.maxVisibleCards });
}

function saveSetting(key, value) {
  localStorage.setItem(key, value);
  Logger.log('info', 'storage', 'ConfigurationSaved', { key, value });
}

/**
 * ============================================================================
 * 4. NETWORK CLIENT (Fetching JSON & Markdown)
 * ============================================================================
 */
async function fetchData() {
  const fetchStartTime = performance.now();
  Logger.log('info', 'network', 'FetchResourcesStarted');

  try {
    const [reposResponse, changelogResponse] = await Promise.all([
      fetch('../repos_output.json'),
      fetch('../CHANGELOG.md')
    ]);

    if (!reposResponse.ok) {
      throw new Error(`Failed to load repos_output.json: ${reposResponse.status} ${reposResponse.statusText}`);
    }
    if (!changelogResponse.ok) {
      throw new Error(`Failed to load CHANGELOG.md: ${changelogResponse.status} ${changelogResponse.statusText}`);
    }

    const reposData = await reposResponse.json();
    state.repos = reposData.repos || [];
    state.changelogMarkdown = await changelogResponse.text();

    Logger.log('info', 'network', 'FetchResourcesCompleted', { repos_count: state.repos.length }, Math.round(performance.now() - fetchStartTime));

    // Calculate database stats
    calculateStats(reposData);
    
    // Render components
    renderStats();
    renderGrid();
    renderChangelog();
    
    // Evaluate initial route
    handleRouting();
    
  } catch (error) {
    Logger.log('error', 'network', 'FetchResourcesFailed', { error: error.message }, Math.round(performance.now() - fetchStartTime));
    throw error;
  }
}

function calculateStats(data) {
  const calcStartTime = performance.now();
  
  const repos = state.repos;
  const totalStars = repos.reduce((sum, r) => sum + r.stars, 0);
  const avgStars = repos.length > 0 ? Math.round(totalStars / repos.length) : 0;
  
  // Calculate top programming language
  const langCounts = {};
  repos.forEach(r => {
    if (r.language && r.language !== 'Unknown') {
      langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    }
  });
  
  let topLang = 'N/A';
  let maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts)) {
    if (count > maxCount) {
      maxCount = count;
      topLang = lang;
    }
  }

  state.stats = {
    totalStars,
    totalRepos: repos.length,
    topLang,
    avgStars
  };

  Logger.log('info', 'ui', 'StatsCalculated', state.stats, Math.round(performance.now() - calcStartTime));
}

/**
 * ============================================================================
 * 5. RENDERING PIPELINES (Stats, Grid, Markdown)
 * ============================================================================
 */
function renderStats() {
  document.getElementById('stat-total-stars').textContent = formatStarNumber(state.stats.totalStars);
  document.getElementById('stat-total-repos').textContent = state.stats.totalRepos;
  document.getElementById('stat-top-lang').textContent = state.stats.topLang;
  document.getElementById('stat-avg-stars').textContent = formatStarNumber(state.stats.avgStars);
  Logger.log('info', 'ui', 'StatsRendered');
}

function renderGrid() {
  const renderStartTime = performance.now();
  const gridContainer = document.getElementById('cards-grid');
  gridContainer.innerHTML = '';

  if (state.repos.length === 0) {
    gridContainer.innerHTML = `<div class="loading-state"><p>No repositories available.</p></div>`;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.repos.forEach(repo => {
    const card = document.createElement('div');
    card.className = 'repo-card glass-card';
    card.id = `repo-${repo.rank}`;
    card.setAttribute('data-category', repo.category ? repo.category.toLowerCase() : 'other');
    card.setAttribute('data-lang', repo.language ? repo.language.toLowerCase() : 'unknown');
    card.setAttribute('data-stars', repo.stars);
    card.setAttribute('data-rank', repo.rank);
    card.setAttribute('data-name', repo.full_name.toLowerCase());

    // Color indicators for languages
    const langColor = getLanguageColor(repo.language);

    // Escape description & summaries to prevent HTML injections
    const escapedDesc = escapeHTML(repo.description || 'No description');
    const escapedReadme = escapeHTML(repo.readme_summary || repo.description || 'No README summary extracted.');

    card.innerHTML = `
      <div class="card-header-row">
        <div class="card-title-group">
          <span class="repo-rank-badge">#${repo.rank}</span>
          <a href="${repo.url}" target="_blank" class="repo-name">${repo.full_name}</a>
        </div>
        <div class="star-count">
          <i data-lucide="star"></i>
          <span>${formatStarNumber(repo.stars)}</span>
        </div>
      </div>
      <p class="repo-desc">${escapedDesc}</p>
      
      <!-- Expandable Fold for README summary -->
      <div class="card-readme-fold" id="fold-${repo.rank}">
        <div class="readme-title-row">
          <i data-lucide="book-open"></i>
          <span>README Intro Summary</span>
        </div>
        <p class="readme-text">${escapedReadme}</p>
      </div>

      <div class="repo-metadata-footer">
        <div class="lang-chip">
          <span class="lang-dot" style="background-color: ${langColor}"></span>
          <span>${repo.language || 'N/A'}</span>
        </div>
        <div class="update-date" title="Last updated time">
          <i data-lucide="calendar"></i>
          <span>${formatDate(repo.last_updated)}</span>
        </div>
      </div>

      <button class="fold-toggle-btn" data-rank="${repo.rank}">
        <span>Show summary</span>
        <i data-lucide="chevron-down"></i>
      </button>
    `;

    fragment.appendChild(card);
  });

  gridContainer.appendChild(fragment);
  
  // Re-initialize Lucide Icons on the freshly injected elements
  lucide.createIcons();

  Logger.log('info', 'ui', 'CardsGridPreRendered', { total_rendered: state.repos.length }, Math.round(performance.now() - renderStartTime));

  // Connect expandable fold click events
  connectFoldEvents();
  
  // Apply filters to initial list
  applyFilters();
}

function renderChangelog() {
  const changelogContainer = document.getElementById('changelog-markdown');
  try {
    // Marked parsing options
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false
    });
    
    changelogContainer.innerHTML = marked.parse(state.changelogMarkdown);
    Logger.log('info', 'ui', 'ChangelogRendered');
  } catch (err) {
    Logger.log('error', 'ui', 'ChangelogRenderFailed', { error: err.message });
    changelogContainer.innerHTML = `<div class="loading-state"><p class="error-text">Failed to parse changelog Markdown.</p></div>`;
  }
}

/**
 * ============================================================================
 * 6. UI ACTIONS & EVENT LISTENERS
 * ============================================================================
 */
function initUI() {
  // Sync AppLogger console with UI DOM element
  const logConsole = document.getElementById('log-console');
  Logger.setUIConsole(logConsole);

  // Tab Navigation Click Bindings
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      setRoute(targetTab);
    });
  });

  // Settings Drawer Toggle Elements
  const settingsBtn = document.getElementById('settings-toggle-btn');
  const closeSettingsBtn = document.getElementById('settings-close-btn');
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');

  const openDrawer = () => {
    drawer.classList.add('open');
    overlay.classList.add('visible');
    Logger.log('info', 'ui', 'SettingsDrawerOpened');
  };

  const closeDrawer = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    Logger.log('info', 'ui', 'SettingsDrawerClosed');
  };

  settingsBtn.addEventListener('click', openDrawer);
  closeSettingsBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Layout Density configuration
  const densityBtns = document.querySelectorAll('.density-btn');
  densityBtns.forEach(btn => {
    // Initialize active visual state
    if (btn.getAttribute('data-density') === state.density) {
      densityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      densityBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.density = btn.getAttribute('data-density');
      document.documentElement.setAttribute('data-density', state.density);
      saveSetting(CONFIG_KEYS.DENSITY, state.density);
      Logger.log('info', 'ui', 'LayoutDensityChanged', { density: state.density });
    });
  });

  // Max Visible Cards range slider
  const maxCardsSlider = document.getElementById('max-cards-slider');
  const maxCardsBadge = document.getElementById('max-cards-badge');
  
  maxCardsSlider.value = state.maxVisibleCards;
  maxCardsBadge.textContent = state.maxVisibleCards >= 350 ? 'All' : state.maxVisibleCards;

  maxCardsSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    state.maxVisibleCards = val;
    maxCardsBadge.textContent = val >= 350 ? 'All' : val;
    saveSetting(CONFIG_KEYS.MAX_CARDS, val);
    
    // Run filtering instantly on selection update
    applyFilters();
  });

  // Pitch Black theme selector
  const amoledSwitch = document.getElementById('pitch-black-switch');
  if (state.theme === 'pitch-black') {
    amoledSwitch.checked = true;
  }
  amoledSwitch.addEventListener('change', (e) => {
    state.theme = e.target.checked ? 'pitch-black' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    saveSetting(CONFIG_KEYS.THEME, state.theme);
    Logger.log('info', 'ui', 'ThemeChanged', { theme: state.theme });
  });

  // Diagnostic Logs download anchor
  const logDownloadBtn = document.getElementById('log-download-btn');
  logDownloadBtn.addEventListener('click', () => Logger.downloadLogs());

  // Sorting drop-down selectors
  const sortSelect = document.getElementById('sort-select');
  sortSelect.addEventListener('change', (e) => {
    state.activeSort = e.target.value;
    Logger.log('info', 'ui', 'SortModeChanged', { sort: state.activeSort });
    applyFilters();
  });

  // Category selection tab items
  const catTabs = document.querySelectorAll('.category-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeCategory = tab.getAttribute('data-category');
      Logger.log('info', 'ui', 'CategoryTabChanged', { category: state.activeCategory });
      applyFilters();
    });
  });

  // Debounced input search queries
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('search-clear-btn');
  let debounceTimeout = null;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length > 0) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      state.searchQuery = query;
      Logger.log('info', 'ui', 'SearchQueryExecuted', { query });
      applyFilters();
    }, 150); // 150ms debounce threshold
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    Logger.log('info', 'ui', 'SearchQueryCleared');
    applyFilters();
  });

  // Global Routing hash listeners
  window.addEventListener('hashchange', handleRouting);
}

function connectFoldEvents() {
  const toggleButtons = document.querySelectorAll('.fold-toggle-btn');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rank = btn.getAttribute('data-rank');
      const fold = document.getElementById(`fold-${rank}`);
      const btnSpan = btn.querySelector('span');
      
      const isExpanded = fold.classList.toggle('expanded');
      btn.classList.toggle('expanded', isExpanded);
      btnSpan.textContent = isExpanded ? 'Hide summary' : 'Show summary';
      
      Logger.log('info', 'ui', 'CardReadmeFoldToggled', { rank, expanded: isExpanded });
    });
  });
}

/**
 * ============================================================================
 * 7. CLIENT-SIDE QUERY ROUTER (Filter, Sort, Paginate)
 * ============================================================================
 */
function applyFilters() {
  const filterStartTime = performance.now();
  const cardElements = document.querySelectorAll('.repo-card');
  const gridContainer = document.getElementById('cards-grid');

  let matchCount = 0;
  const matches = [];

  // 1. Evaluate filter matches
  cardElements.forEach(card => {
    const rank = parseInt(card.getAttribute('data-rank'));
    const repo = state.repos.find(r => r.rank === rank);
    if (!repo) return;

    let isMatch = true;

    // A. Verify Category Filter
    if (state.activeCategory !== 'all') {
      const keywordMapping = {
        'ai agents': ['agent', 'openclaw', 'codex', 'claude', 'hermes', 'claw', 'opencode', 'grok'],
        'web automation': ['crawl', 'scrape', 'browser', 'selenium', 'playwright', 'puppeteer', 'firecrawl'],
        'llm infrastructure': ['mem', 'rag', 'llm', 'memory', 'knowledge', 'vector', 'embedding'],
        'dev tools': ['editor', 'ide', 'git', 'code', 'cli', 'terminal', 'debug', 'linter'],
        'infrastructure': ['docker', 'devops', 'k8s', 'infra', 'deploy', 'podman', 'terraform']
      };
      
      const categoryKeywords = keywordMapping[state.activeCategory] || [];
      const textToSearch = `${repo.full_name} ${repo.description} ${repo.language}`.toLowerCase();
      
      const matchesCategory = categoryKeywords.some(keyword => textToSearch.includes(keyword));
      if (!matchesCategory) {
        isMatch = false;
      }
    }

    // B. Verify Search Query Filter
    if (isMatch && state.searchQuery.length > 0) {
      const searchTerms = `${repo.full_name} ${repo.description || ''} ${repo.language || ''} ${repo.readme_summary || ''}`.toLowerCase();
      if (!searchTerms.includes(state.searchQuery)) {
        isMatch = false;
      }
    }

    if (isMatch) {
      matches.push({ card, repo });
    } else {
      card.classList.add('hidden');
    }
  });

  // 2. Evaluate Sorting criteria
  matches.sort((a, b) => {
    if (state.activeSort === 'stars-desc') {
      return b.repo.stars - a.repo.stars;
    } else if (state.activeSort === 'stars-asc') {
      return a.repo.stars - b.repo.stars;
    } else if (state.activeSort === 'rank-asc') {
      return a.repo.rank - b.repo.rank;
    } else if (state.activeSort === 'name-asc') {
      return a.repo.full_name.localeCompare(b.repo.full_name);
    }
    return 0;
  });

  // 3. Evaluate limits and apply render attributes
  matches.forEach((item, index) => {
    if (index < state.maxVisibleCards) {
      item.card.classList.remove('hidden');
      // Use CSS order to sort elements dynamically without re-appending DOM nodes (zero layout shift)
      item.card.style.order = index;
      matchCount++;
    } else {
      item.card.classList.add('hidden');
    }
  });

  // Handle empty match states
  let emptyStateMsg = document.getElementById('grid-empty-message');
  if (matchCount === 0) {
    if (!emptyStateMsg) {
      emptyStateMsg = document.createElement('div');
      emptyStateMsg.id = 'grid-empty-message';
      emptyStateMsg.className = 'loading-state';
      emptyStateMsg.innerHTML = `<p>No repositories match your criteria.</p>`;
      gridContainer.appendChild(emptyStateMsg);
    }
  } else if (emptyStateMsg) {
    emptyStateMsg.remove();
  }

  Logger.log('info', 'ui', 'FiltersApplied', { 
    matched: matchCount, 
    total: state.repos.length, 
    category: state.activeCategory, 
    sort: state.activeSort,
    search: state.searchQuery,
    limit: state.maxVisibleCards
  }, Math.round(performance.now() - filterStartTime));
}

/**
 * ============================================================================
 * 8. SYSTEM ROUTER & VIEW NAVIGATION
 * ============================================================================
 */
function setRoute(tab) {
  window.location.hash = `view=${tab}`;
}

function handleRouting() {
  const hash = window.location.hash || '#view=grid';
  const match = hash.match(/#view=(\w+)/);
  const activeTab = match ? match[1] : 'grid';

  // Toggle view section visibility
  const views = document.querySelectorAll('.tab-view');
  views.forEach(v => {
    v.classList.remove('active');
    if (v.id === `view-${activeTab}`) {
      v.classList.add('active');
    }
  });

  // Toggle visual states of nav controls
  const tabButtons = document.querySelectorAll('.nav-tab');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === activeTab) {
      btn.classList.add('active');
    }
  });

  Logger.log('info', 'ui', 'RouteChanged', { view: activeTab });
}

/**
 * ============================================================================
 * 9. INTERNALS & TRANSLATORS (Formatting, Colors, Overlays)
 * ============================================================================
 */
function formatStarNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

function formatDate(isoString) {
  if (!isoString || isoString === 'Unknown') return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function getLanguageColor(lang) {
  const colors = {
    'TypeScript': '#3178c6',
    'JavaScript': '#f1e05a',
    'Python': '#3572A5',
    'Rust': '#dee5e6',
    'Go': '#00ADD8',
    'Shell': '#89e051',
    'Kotlin': '#A97BFF',
    'Java': '#b07219',
    'C++': '#f34b7d',
    'C': '#555555',
    'Swift': '#F05138',
    'Dart': '#00B4AB',
    'HTML': '#e34c26',
    'CSS': '#563d7c'
  };
  return colors[lang] || '#8b949e';
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
  const overlay = document.getElementById('error-overlay');
  const messageElement = document.getElementById('error-message');
  
  if (overlay && messageElement) {
    messageElement.textContent = msg;
    overlay.classList.remove('hidden');
  }
}
