// ── READING PROGRESS BAR ─────────────────────────────────────
(function () {
  const bar = document.getElementById('reading-progress');
  if (!bar) return;

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
})();

// ── ESTIMATED READ TIME ───────────────────────────────────────
(function () {
  const body = document.querySelector('.article-content, .article-body');
  if (!body) return;

  const words = body.innerText.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));

  // Find the article-meta element and append read time
  const meta = document.querySelector('.article-meta');
  if (meta) {
    const rt = document.createElement('span');
    rt.className = 'read-time';
    rt.textContent = `${minutes} min read`;
    meta.appendChild(rt);
  }
})();

// ── THEME TOGGLE ──────────────────────────────────────────────
(function () {
  const t = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', t);

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  });
})();
