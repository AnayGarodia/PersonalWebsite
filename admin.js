// ── CONFIG ──────────────────────────────────────────────────
const GITHUB_OWNER = 'AnayGarodia';
const GITHUB_REPO  = 'PersonalWebsite';
const GITHUB_BRANCH = 'main';

// ── STATE ───────────────────────────────────────────────────
let state = {
  content: null,
  contentSHA: null,
  pat: null,
  readOnly: false,
  fetchedRepos: [],
  articleFileSHAs: {},   // id -> sha (for article HTML files)
  currentModal: null,    // current modal context
};

// ── CRYPTO ──────────────────────────────────────────────────
async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── AUTH FLOW ────────────────────────────────────────────────
function show(id) {
  ['login-screen','setup-screen','pat-screen','admin-panel'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.hidden = (s !== id);
  });
}

async function initAuth() {
  // Apply saved theme before rendering anything
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

  const storedHash = localStorage.getItem('adminHash');
  if (!storedHash) {
    show('setup-screen');
    setupSetupScreen();
  } else {
    show('login-screen');
    setupLoginScreen(storedHash);
  }
}

function setupSetupScreen() {
  document.getElementById('setup-btn').addEventListener('click', async () => {
    const pw  = document.getElementById('setup-password').value;
    const pw2 = document.getElementById('setup-confirm').value;
    const err = document.getElementById('setup-error');
    if (!pw) { err.textContent = 'Password cannot be empty.'; err.hidden = false; return; }
    if (pw !== pw2) { err.textContent = 'Passwords do not match.'; err.hidden = false; return; }
    const hash = await sha256(pw);
    localStorage.setItem('adminHash', hash);
    err.hidden = true;
    show('pat-screen');
    setupPatScreen();
  });
}

function setupLoginScreen(storedHash) {
  const input = document.getElementById('password-input');
  const err   = document.getElementById('login-error');

  async function attempt() {
    const hash = await sha256(input.value);
    if (hash === storedHash) {
      err.hidden = true;
      const savedPAT = sessionStorage.getItem('ghPAT');
      if (savedPAT) { state.pat = savedPAT; await loadAdminPanel(); }
      else { show('pat-screen'); setupPatScreen(); }
    } else {
      err.hidden = false;
      input.value = '';
      input.focus();
    }
  }

  document.getElementById('login-btn').addEventListener('click', attempt);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt(); });
  input.focus();
}

function setupPatScreen() {
  document.getElementById('pat-btn').addEventListener('click', async () => {
    const pat = document.getElementById('pat-input').value.trim();
    if (pat) {
      sessionStorage.setItem('ghPAT', pat);
      state.pat = pat;
      state.readOnly = false;
    }
    await loadAdminPanel();
  });

  document.getElementById('pat-skip-btn').addEventListener('click', async () => {
    state.readOnly = true;
    await loadAdminPanel();
  });

  document.getElementById('pat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('pat-btn').click();
  });
}

// ── GITHUB API ───────────────────────────────────────────────
function ghHeaders() {
  const headers = { 'Accept': 'application/vnd.github+json' };
  if (state.pat) headers['Authorization'] = `Bearer ${state.pat}`;
  return headers;
}

async function ghGet(path) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`, {
    headers: ghHeaders()
  });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function ghPut(path, content, sha, message) {
  if (state.readOnly) throw new Error('Read-only mode — no PAT provided');
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(content))),
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub PUT failed: ${res.status}`);
  }
  return res.json();
}

async function fetchContentJSON() {
  const data = await ghGet('content.json');
  state.contentSHA = data.sha;
  const text = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
  state.content = JSON.parse(text);
}

async function fetchArticleHTML(id) {
  try {
    const data = await ghGet(`articles/${id}.html`);
    state.articleFileSHAs[id] = data.sha;
    return decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
  } catch {
    return null;
  }
}

// ── LOAD ADMIN PANEL ─────────────────────────────────────────
async function loadAdminPanel() {
  show('admin-panel');
  setStatus('Loading content…');
  try {
    await fetchContentJSON();
    setStatus(state.readOnly ? 'Read-only mode (no PAT)' : '');
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
  }

  renderCurrentTab();
  setupTabNav();
  setupSaveButton();
  setupLogout();
}

// ── TABS ─────────────────────────────────────────────────────
function setupTabNav() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.getElementById(`tab-${tab}`).classList.add('active');
      renderTab(tab);
    });
  });
}

function renderCurrentTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  renderTab(activeBtn ? activeBtn.dataset.tab : 'about');
}

function renderTab(tab) {
  switch (tab) {
    case 'about':       renderAboutTab(); break;
    case 'articles':    renderArticlesTab(); break;
    case 'projects':    renderProjectsTab(); break;
    case 'experiments': renderExperimentsTab(); break;
    case 'github':      renderGithubTab(); break;
    case 'experiences': renderExperiencesTab(); break;
  }
}

// ── ABOUT TAB ────────────────────────────────────────────────
function renderAboutTab() {
  const ta = document.getElementById('about-editor');
  if (!ta || !state.content) return;
  ta.value = state.content.about || '';
  ta.oninput = () => { state.content.about = ta.value; };
}

// ── ARTICLES TAB ─────────────────────────────────────────────
function renderArticlesTab() {
  const list = document.getElementById('articles-list');
  if (!list || !state.content) return;
  const articles = state.content.articles || [];

  list.innerHTML = articles.map((a, i) => `
    <div class="item-card" data-i="${i}">
      <div class="item-card-body">
        <div class="item-card-title">${a.title}</div>
        <div class="item-card-meta">${a.category} · ${a.date}${a.placeholder ? '' : ''}</div>
      </div>
      ${a.placeholder ? '<span class="item-card-badge">draft</span>' : ''}
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editArticle(${i})">edit</button>
        <button class="btn-icon" onclick="editArticleBody(${i})">write</button>
        <button class="btn-icon danger" onclick="deleteItem('articles',${i})">del</button>
      </div>
    </div>
  `).join('');

  document.getElementById('add-article-btn').onclick = () => editArticle(-1);
}

function editArticle(idx) {
  const a = idx >= 0 ? { ...state.content.articles[idx] } : {
    id: '', title: '', description: '', category: 'essays', date: '', placeholder: false, tags: []
  };

  openModal(idx >= 0 ? 'Edit Article' : 'New Article', `
    <div class="form-row"><label>ID (filename slug)</label>
      <input type="text" id="f-id" value="${esc(a.id)}" placeholder="my-article" /></div>
    <div class="form-row"><label>Title</label>
      <input type="text" id="f-title" value="${esc(a.title)}" /></div>
    <div class="form-row"><label>Description</label>
      <textarea id="f-desc">${esc(a.description)}</textarea></div>
    <div class="form-row-2col">
      <div class="form-row"><label>Category</label>
        <select id="f-cat">
          ${['technical','essays','blog'].map(c => `<option ${a.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
      <div class="form-row"><label>Date (YYYY-MM)</label>
        <input type="text" id="f-date" value="${esc(a.date)}" placeholder="2025-01" /></div>
    </div>
    <div class="form-row"><label>Tags (comma-separated)</label>
      <input type="text" id="f-tags" value="${(a.tags||[]).join(', ')}" /></div>
    <div class="form-checkbox">
      <input type="checkbox" id="f-placeholder" ${a.placeholder?'checked':''} />
      <label for="f-placeholder">Mark as draft / placeholder</label>
    </div>
  `, async () => {
    const updated = {
      id:          document.getElementById('f-id').value.trim(),
      title:       document.getElementById('f-title').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      category:    document.getElementById('f-cat').value,
      date:        document.getElementById('f-date').value.trim(),
      featured:    a.featured || false,
      placeholder: document.getElementById('f-placeholder').checked,
      tags:        document.getElementById('f-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
    };
    if (!updated.id || !updated.title) { toast('ID and title are required', 'error'); return; }

    if (idx >= 0) state.content.articles[idx] = updated;
    else state.content.articles.push(updated);

    // Create stub HTML file for new articles
    if (idx < 0) {
      await createArticleStub(updated);
    }

    closeModal();
    renderArticlesTab();
    toast('Article saved locally — click "Save to GitHub" to publish');
  });
}

async function createArticleStub(article) {
  if (state.readOnly) return;
  const html = articleStubTemplate(article);
  try {
    await ghPut(`articles/${article.id}.html`, html, null, `Add article stub: ${article.title}`);
    toast(`Created articles/${article.id}.html`, 'success');
  } catch (err) {
    toast(`Stub creation failed: ${err.message}`, 'error');
  }
}

function articleStubTemplate(a) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${a.title} · Anay Garodia</title>
  <link rel="stylesheet" href="articles-styles.css"/>
</head>
<body>
<div class="article-wrapper">
  <nav class="article-nav">
    <a href="../index.html" class="back-link">← back</a>
    <button class="theme-toggle" aria-label="Toggle dark mode">
      <span class="icon-wrap">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </span>
    </button>
  </nav>

  <div class="article-container">
    <header class="article-header">
      <h1>${a.title}</h1>
      <p class="article-meta">${a.date}</p>
    </header>

    <div class="article-content">
      <p>[Article content goes here]</p>
    </div>
  </div>
</div>
<script>
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('theme', n);
  });
<\/script>
</body>
</html>`;
}

async function editArticleBody(idx) {
  const article = state.content.articles[idx];
  if (!article) return;

  setStatus('Loading article…');
  let existingContent = '';
  const html = await fetchArticleHTML(article.id);
  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const contentDiv = doc.querySelector('.article-content');
    if (contentDiv) {
      existingContent = contentDiv.innerHTML.trim();
      if (existingContent === '<p>[Article content goes here]</p>') existingContent = '';
    }
  }
  setStatus('');
  openWysiwygEditor(article, idx, existingContent);
}

function openWysiwygEditor(article, idx, initialHTML) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('editor-mode');

  openModal(`Write: ${article.title}`, `
    <div class="editor-toolbar">
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('bold')" title="Bold"><b>B</b></button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('italic')" title="Italic"><i>I</i></button>
      <span class="toolbar-sep"></span>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('formatBlock',false,'h2')" title="Heading 2">H2</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('formatBlock',false,'h3')" title="Heading 3">H3</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('formatBlock',false,'p')" title="Paragraph">¶</button>
      <span class="toolbar-sep"></span>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertUnorderedList')" title="Bullet list">• list</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertOrderedList')" title="Numbered list">1. list</button>
      <span class="toolbar-sep"></span>
      <button class="toolbar-btn" onmousedown="event.preventDefault();wysiInsertLink()" title="Link">link</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('unlink')" title="Remove link">unlink</button>
      <button class="toolbar-btn" onmousedown="event.preventDefault();document.execCommand('insertHorizontalRule')" title="Divider">—</button>
    </div>
    <div id="wysi-editor" class="wysi-editor" contenteditable="true">${initialHTML || '<p></p>'}</div>
  `, async () => {
    const editor = document.getElementById('wysi-editor');
    const htmlBody = editor.innerHTML;
    const fullHTML = buildArticleHTML(article, htmlBody);
    try {
      const sha = state.articleFileSHAs[article.id] || null;
      const result = await ghPut(`articles/${article.id}.html`, fullHTML, sha, `Update article: ${article.title}`);
      state.articleFileSHAs[article.id] = result.content.sha;
      if ('markdown_source' in (state.content.articles[idx] || {})) {
        delete state.content.articles[idx].markdown_source;
      }
      overlay.classList.remove('editor-mode');
      closeModal();
      toast('Article saved!', 'success');
    } catch (err) {
      toast(`Save failed: ${err.message}`, 'error');
    }
  });

  document.getElementById('modal-cancel').onclick = () => {
    overlay.classList.remove('editor-mode');
    closeModal();
  };
  document.getElementById('modal-close').onclick = () => {
    overlay.classList.remove('editor-mode');
    closeModal();
  };
}

window.wysiInsertLink = function() {
  const url = prompt('Enter URL:');
  if (url) document.execCommand('createLink', false, url);
};

function buildArticleHTML(article, htmlBody) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${article.title} · Anay Garodia</title>
  <link rel="stylesheet" href="articles-styles.css"/>
</head>
<body>
<div class="article-wrapper">
  <nav class="article-nav">
    <a href="../index.html" class="back-link">← back</a>
    <button class="theme-toggle" aria-label="Toggle dark mode">
      <span class="icon-wrap">
        <svg class="sun-icon" viewBox="0 0 24 24" fill="none" stroke-width="2">
          <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        </svg>
        <svg class="moon-icon" viewBox="0 0 24 24" fill="none" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </span>
    </button>
  </nav>

  <div class="article-container">
    <header class="article-header">
      <h1>${article.title}</h1>
      <p class="article-meta">${article.date}</p>
    </header>

    <div class="article-content">
      ${htmlBody}
    </div>
  </div>
</div>
<script>
  const t = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('.theme-toggle').addEventListener('click', () => {
    const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('theme', n);
  });
<\/script>
</body>
</html>`;
}

// ── PROJECTS TAB ─────────────────────────────────────────────
function renderProjectsTab() {
  const list = document.getElementById('projects-list');
  if (!list || !state.content) return;
  const projects = state.content.projects || [];

  list.innerHTML = projects.map((p, i) => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${p.title}</div>
        <div class="item-card-meta">${p.date}${p.organization ? ' · ' + p.organization : ''}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editProject(${i})">edit</button>
        <button class="btn-icon danger" onclick="deleteItem('projects',${i})">del</button>
      </div>
    </div>
  `).join('');

  document.getElementById('add-project-btn').onclick = () => editProject(-1);
}

function editProject(idx) {
  const p = idx >= 0 ? { ...state.content.projects[idx] } : {
    id: '', title: '', description: '', date: '', organization: '', featured: false, tags: [], link: ''
  };

  openModal(idx >= 0 ? 'Edit Project' : 'New Project', `
    <div class="form-row"><label>ID</label>
      <input type="text" id="f-id" value="${esc(p.id)}" placeholder="my-project" /></div>
    <div class="form-row"><label>Title</label>
      <input type="text" id="f-title" value="${esc(p.title)}" /></div>
    <div class="form-row"><label>Description</label>
      <textarea id="f-desc">${esc(p.description)}</textarea></div>
    <div class="form-row-2col">
      <div class="form-row"><label>Date</label>
        <input type="text" id="f-date" value="${esc(p.date)}" placeholder="2024" /></div>
      <div class="form-row"><label>Organization</label>
        <input type="text" id="f-org" value="${esc(p.organization||'')}" /></div>
    </div>
    <div class="form-row"><label>Tags (comma-separated)</label>
      <input type="text" id="f-tags" value="${(p.tags||[]).join(', ')}" /></div>
    <div class="form-row"><label>Link</label>
      <input type="text" id="f-link" value="${esc(p.link||'')}" placeholder="projects/my-project.html" /></div>
    <div class="form-checkbox">
      <input type="checkbox" id="f-featured" ${p.featured?'checked':''} />
      <label for="f-featured">Featured</label>
    </div>
  `, () => {
    const updated = {
      id:           document.getElementById('f-id').value.trim(),
      title:        document.getElementById('f-title').value.trim(),
      description:  document.getElementById('f-desc').value.trim(),
      date:         document.getElementById('f-date').value.trim(),
      organization: document.getElementById('f-org').value.trim(),
      featured:     document.getElementById('f-featured').checked,
      tags:         document.getElementById('f-tags').value.split(',').map(t=>t.trim()).filter(Boolean),
      link:         document.getElementById('f-link').value.trim(),
    };
    if (!updated.title) { toast('Title is required', 'error'); return; }

    if (idx >= 0) state.content.projects[idx] = updated;
    else state.content.projects.push(updated);
    closeModal();
    renderProjectsTab();
    toast('Project saved locally — click "Save to GitHub" to publish');
  });
}

// ── EXPERIMENTS TAB ──────────────────────────────────────────
function renderExperimentsTab() {
  const list = document.getElementById('experiments-list');
  if (!list || !state.content) return;
  const experiments = state.content.experiments || [];

  list.innerHTML = experiments.map((e, i) => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${e.title}</div>
        <div class="item-card-meta">${e.link}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editExperiment(${i})">edit</button>
        <button class="btn-icon danger" onclick="deleteItem('experiments',${i})">del</button>
      </div>
    </div>
  `).join('');

  document.getElementById('add-experiment-btn').onclick = () => editExperiment(-1);
}

function editExperiment(idx) {
  const e = idx >= 0 ? { ...state.content.experiments[idx] } : {
    id: '', title: '', description: '', link: '', image: ''
  };

  openModal(idx >= 0 ? 'Edit Experiment' : 'New Experiment', `
    <div class="form-row"><label>ID</label>
      <input type="text" id="f-id" value="${esc(e.id)}" /></div>
    <div class="form-row"><label>Title</label>
      <input type="text" id="f-title" value="${esc(e.title)}" /></div>
    <div class="form-row"><label>Description</label>
      <textarea id="f-desc">${esc(e.description)}</textarea></div>
    <div class="form-row"><label>Link</label>
      <input type="text" id="f-link" value="${esc(e.link)}" placeholder="experiments/my-experiment.html" /></div>
    <div class="form-row"><label>Background image path (optional)</label>
      <input type="text" id="f-image" value="${esc(e.image||'')}" placeholder="images/my-image.png" /></div>
  `, () => {
    const updated = {
      id:          document.getElementById('f-id').value.trim(),
      title:       document.getElementById('f-title').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
      link:        document.getElementById('f-link').value.trim(),
      image:       document.getElementById('f-image').value.trim(),
    };
    if (!updated.id || !updated.title || !updated.link) { toast('ID, title, and link are required', 'error'); return; }
    if (!updated.image) delete updated.image;

    if (idx >= 0) state.content.experiments[idx] = updated;
    else state.content.experiments.push(updated);
    closeModal();
    renderExperimentsTab();
    toast('Experiment saved locally — click "Save to GitHub" to publish');
  });
}

// ── GITHUB TAB ───────────────────────────────────────────────
function renderGithubTab() {
  renderDisplayedRepos();
  document.getElementById('fetch-repos-btn').onclick = fetchGithubRepos;
}

async function fetchGithubRepos() {
  const username = document.getElementById('github-username').value.trim() || GITHUB_OWNER;
  const picker = document.getElementById('repo-picker');
  picker.innerHTML = '<p style="font-size:0.75rem;color:var(--text-faint)">Fetching…</p>';

  try {
    const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
      headers: ghHeaders()
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const repos = await res.json();
    state.fetchedRepos = repos;

    const displayedIds = new Set((state.content.github_repos||[]).map(r => r.name));

    picker.innerHTML = `
      <div class="picker-actions">
        <button class="btn-add" onclick="addSelectedRepos()">Add selected →</button>
      </div>
      ${repos.filter(r => !r.fork).map(r => `
        <div class="repo-pick-card" data-name="${esc(r.name)}" onclick="this.classList.toggle('selected')">
          <div class="repo-pick-name">${r.name}${displayedIds.has(r.name) ? ' ✓' : ''}</div>
          <div class="repo-pick-desc">${r.description || 'No description.'}</div>
          <div class="repo-pick-meta">${r.language || 'unknown'} · ★ ${r.stargazers_count}</div>
        </div>
      `).join('')}
    `;
  } catch (err) {
    picker.innerHTML = `<p style="font-size:0.75rem;color:var(--accent2)">Error: ${err.message}</p>`;
  }
}

function addSelectedRepos() {
  const selected = document.querySelectorAll('.repo-pick-card.selected');
  if (selected.length === 0) { toast('No repos selected', 'error'); return; }

  const existing = new Set((state.content.github_repos||[]).map(r => r.name));

  selected.forEach(card => {
    const name = card.dataset.name;
    if (existing.has(name)) return;
    const repo = state.fetchedRepos.find(r => r.name === name);
    if (!repo) return;
    state.content.github_repos.push({
      name:        repo.name,
      description: repo.description || '',
      url:         repo.html_url,
      language:    repo.language || '',
      stars:       repo.stargazers_count,
      topics:      repo.topics || [],
    });
    existing.add(name);
  });

  renderDisplayedRepos();
  document.querySelectorAll('.repo-pick-card.selected').forEach(c => c.classList.remove('selected'));
  toast('Repos added — click "Save to GitHub" to publish');
}

function renderDisplayedRepos() {
  const list = document.getElementById('displayed-repos');
  if (!list || !state.content) return;
  const repos = state.content.github_repos || [];

  if (repos.length === 0) {
    list.innerHTML = '<p style="font-size:0.75rem;color:var(--text-faint)">No repos added yet.</p>';
    return;
  }

  list.innerHTML = repos.map((r, i) => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${r.name}</div>
        <div class="item-card-meta">${r.language || 'unknown'} · ★ ${r.stars||0}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon danger" onclick="deleteItem('github_repos',${i})">remove</button>
      </div>
    </div>
  `).join('');
}

// ── EXPERIENCES TAB ──────────────────────────────────────────
function renderExperiencesTab() {
  const list = document.getElementById('experiences-list');
  if (!list || !state.content) return;
  const experiences = state.content.experiences || [];

  list.innerHTML = experiences.map((e, i) => `
    <div class="item-card">
      <div class="item-card-body">
        <div class="item-card-title">${e.title}</div>
        <div class="item-card-meta">${e.meta}</div>
      </div>
      <div class="item-card-actions">
        <button class="btn-icon" onclick="editExperience(${i})">edit</button>
        <button class="btn-icon danger" onclick="deleteItem('experiences',${i})">del</button>
      </div>
    </div>
  `).join('');

  document.getElementById('add-experience-btn').onclick = () => editExperience(-1);
}

function editExperience(idx) {
  const e = idx >= 0 ? { ...state.content.experiences[idx] } : {
    title: '', meta: '', description: ''
  };

  openModal(idx >= 0 ? 'Edit Experience' : 'New Experience', `
    <div class="form-row"><label>Title</label>
      <input type="text" id="f-title" value="${esc(e.title)}" /></div>
    <div class="form-row"><label>Meta (date · detail)</label>
      <input type="text" id="f-meta" value="${esc(e.meta)}" placeholder="2025–2029 · Mathematics" /></div>
    <div class="form-row"><label>Description</label>
      <textarea id="f-desc">${esc(e.description)}</textarea></div>
  `, () => {
    const updated = {
      title:       document.getElementById('f-title').value.trim(),
      meta:        document.getElementById('f-meta').value.trim(),
      description: document.getElementById('f-desc').value.trim(),
    };
    if (!updated.title) { toast('Title is required', 'error'); return; }

    if (idx >= 0) state.content.experiences[idx] = updated;
    else state.content.experiences.push(updated);
    closeModal();
    renderExperiencesTab();
    toast('Experience saved locally — click "Save to GitHub" to publish');
  });
}

// ── DELETE ────────────────────────────────────────────────────
function deleteItem(key, idx) {
  if (!confirm('Delete this item?')) return;
  state.content[key].splice(idx, 1);
  renderTab(document.querySelector('.tab-btn.active').dataset.tab);
  toast('Deleted — click "Save to GitHub" to publish');
}

// ── SAVE TO GITHUB ───────────────────────────────────────────
function setupSaveButton() {
  document.getElementById('save-btn').addEventListener('click', saveToGithub);
}

async function saveToGithub() {
  if (state.readOnly) {
    toast('Read-only mode — enter a GitHub PAT to save', 'error');
    return;
  }
  setStatus('Saving…');
  try {
    const json = JSON.stringify(state.content, null, 2);
    const result = await ghPut('content.json', json, state.contentSHA, 'Update content via admin panel');
    state.contentSHA = result.content.sha;
    setStatus('Saved ✓', false);
    toast('Saved to GitHub!', 'success');
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
    toast(`Save failed: ${err.message}`, 'error');
  }
}

// ── LOGOUT ───────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('ghPAT');
    state = { content: null, contentSHA: null, pat: null, readOnly: false, fetchedRepos: [], articleFileSHAs: {}, currentModal: null };
    show('login-screen');
    setupLoginScreen(localStorage.getItem('adminHash'));
  });
}

// ── MODAL ─────────────────────────────────────────────────────
function openModal(title, bodyHTML, onSave) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').hidden = false;
  state.currentModal = onSave;

  document.getElementById('modal-save').onclick = onSave;
  document.getElementById('modal-cancel').onclick = closeModal;
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-overlay').onclick = e => { if (e.target === e.currentTarget) closeModal(); };
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  state.currentModal = null;
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 300);
  }, 3000);
}

// ── STATUS ────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `save-status ${isError ? 'error' : msg.includes('✓') ? 'success' : ''}`;
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initAuth);
