// ── CONTENT LOADING ───────────────────────────────────────────
async function loadContent() {
  try {
    const response = await fetch('content.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderAbout(data.about);
    renderExperiments(data.experiments);
    renderArticles(data.articles);
    renderGithubProjects(data.github_repos);
    renderProjects(data.projects);
    renderExperiences(data.experiences);
  } catch (err) {
    console.error('Error loading content:', err);
  }
}

// ── ABOUT ─────────────────────────────────────────────────────
function renderAbout(about) {
  const el = document.getElementById('about-content');
  if (!el || !about) return;

  // Support both old string format and new object format
  const text = typeof about === 'string' ? about : about.text;
  const currently = typeof about === 'object' && about.currently ? about.currently : [];

  const chipsHtml = currently.length > 0
    ? `<div class="currently-row">
        <span class="currently-label">currently</span>
        ${currently.map(c => `<span class="currently-chip">${c}</span>`).join('')}
      </div>`
    : '';

  el.innerHTML = `<p>${text}</p>${chipsHtml}`;
}

// ── EXPERIMENTS ───────────────────────────────────────────────
function renderExperiments(experiments) {
  const grid = document.querySelector('.experiments-grid');
  if (!grid || !experiments) return;

  grid.innerHTML = experiments.map(exp => `
    <a href="${exp.link}" class="experiment-card ${exp.image ? `card-${exp.id}` : ''}">
      <div class="card-content">
        ${exp.category ? `<span class="experiment-tag">${exp.category}</span>` : ''}
        <h3>${exp.title}</h3>
      </div>
    </a>
  `).join('');
}

// ── ARTICLES ──────────────────────────────────────────────────
function renderArticles(articles) {
  if (!articles) return;
  const categories = ['technical', 'essays', 'blog'];

  categories.forEach(category => {
    const container = document.querySelector(`.articles-container[data-category="${category}"]`);
    if (!container) return;

    const items = articles
      .filter(a => a.category === category)
      .sort((a, b) => b.date.localeCompare(a.date));

    // Hide entire category block if empty
    const categoryBlock = document.querySelector(`[data-writing-cat="${category}"]`);
    if (items.length === 0) {
      if (categoryBlock) categoryBlock.style.display = 'none';
      return;
    }

    container.innerHTML = items.map(article => {
      const placeholderBadge = article.placeholder
        ? '<span class="placeholder-badge">draft</span>'
        : '';
      const dateLabel = article.date
        ? article.date.replace('-', ' / ')
        : '';
      return `
        <a href="articles/${article.id}.html" class="article-link">
          <div class="article-meta">${dateLabel}</div>
          <h4>${article.title}${placeholderBadge}</h4>
          <p>${article.description}</p>
        </a>
      `;
    }).join('');
  });
}

// ── GITHUB PROJECTS ───────────────────────────────────────────
function renderGithubProjects(repos) {
  const grid = document.getElementById('github-grid');
  if (!grid) return;

  if (!repos || repos.length === 0) {
    grid.innerHTML = '<p class="github-empty">No GitHub projects added yet.</p>';
    return;
  }

  const githubIcon = `<svg viewBox="0 0 16 16" stroke-width="1.5">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
  </svg>`;

  // Add "view all" footer after grid
  let footer = document.querySelector('.github-section-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'github-section-footer';
    grid.parentNode.insertBefore(footer, grid.nextSibling);
  }
  footer.innerHTML = `<a href="https://github.com/AnayGarodia" target="_blank" rel="noopener">view all on github →</a>`;

  grid.innerHTML = repos.map(repo => {
    const langClass = repo.language ? `lang-${repo.language.replace(/[^a-zA-Z]/g, '')}` : '';
    const langDot = repo.language
      ? `<span class="github-card-lang ${langClass}"><span class="lang-dot"></span>${repo.language}</span>`
      : '';
    const stars = repo.stars > 0
      ? `<span class="github-card-stars">★ ${repo.stars}</span>`
      : '';
    const topics = repo.topics && repo.topics.length > 0
      ? `<div class="github-card-topics">${repo.topics.slice(0, 4).map(t => `<span class="github-topic">${t}</span>`).join('')}</div>`
      : '';

    return `
      <a href="${repo.url}" class="github-card" target="_blank" rel="noopener">
        <div class="github-card-name">
          ${githubIcon}
          ${repo.name}
        </div>
        <p class="github-card-desc">${repo.description || 'No description.'}</p>
        ${topics}
        <div class="github-card-meta">
          ${langDot}
          ${stars}
        </div>
      </a>
    `;
  }).join('');
}

// ── PROJECTS ──────────────────────────────────────────────────
function renderProjects(projects) {
  const container = document.querySelector('.projects-container');
  if (!container || !projects) return;

  const sorted = [...projects].sort((a, b) => {
    // Featured first, then by date descending
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    const da = a.date.includes('Present') ? '9999' : a.date;
    const db = b.date.includes('Present') ? '9999' : b.date;
    return db.localeCompare(da);
  });

  container.innerHTML = sorted.map(project => {
    const isFeatured = project.featured;
    const featuredBadge = isFeatured ? `<div class="featured-badge">★ featured</div>` : '';
    return `
      <a href="${project.link}" class="timeline-item-link${isFeatured ? ' featured' : ''}">
        <div class="timeline-item">
          ${featuredBadge}
          <h3>${project.title}</h3>
          <div class="timeline-meta">
            ${project.date}${project.organization ? ' · ' + project.organization : ''}
          </div>
          <p>${project.description}</p>
          <div class="tags">
            ${project.tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// ── EXPERIENCES ───────────────────────────────────────────────
function renderExperiences(experiences) {
  const container = document.querySelector('.experiences-container');
  if (!container || !experiences) return;

  container.innerHTML = experiences.map(exp => `
    <div class="timeline-item-static">
      <h3>${exp.title}</h3>
      <div class="timeline-meta">${exp.meta}</div>
      <p>${exp.description}</p>
    </div>
  `).join('');
}

// ── THEME ─────────────────────────────────────────────────────
function initializeTheme() {
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeLabel(currentTheme);

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeLabel(next);
    });
  });
}

function updateThemeLabel(theme) {
  document.querySelectorAll('.theme-label').forEach(el => {
    el.textContent = theme === 'light' ? 'dark' : 'light';
  });
}

// ── SMOOTH SCROLL ─────────────────────────────────────────────
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ── SCROLL SPY + REVEAL ──────────────────────────────────────
function setupScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');

  // Scroll spy observer (active nav)
  if (navItems.length > 0) {
    const spyObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navItems.forEach(item => item.classList.remove('active'));
          const active = document.querySelector(`.sidebar-nav a[href="#${entry.target.id}"]`);
          if (active) active.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    sections.forEach(s => spyObserver.observe(s));
  }

  // Scroll reveal observer (fade-in sections)
  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  sections.forEach(s => revealObserver.observe(s));
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  loadContent();
  setupSmoothScroll();
  setupScrollSpy();
});
