// ── CONTENT LOADING ───────────────────────────────────────────
async function loadContent() {
  try {
    const response = await fetch('content.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderAbout(data.about);
    renderArticles(data.articles);
    renderProjects(data.projects);
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
