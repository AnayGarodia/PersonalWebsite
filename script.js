// Configuration for how many items to show initially
const INITIAL_ITEMS = {
  projects: 3,
  technical: 1,
  essays: 2,
  blog: 1,
};

// Load and render content from content.json
async function loadContent() {
  try {
    const response = await fetch("content.json");
    const data = await response.json();

    renderExperiments(data.experiments);
    renderArticles(data.articles);
    renderProjects(data.projects);
  } catch (error) {
    console.error("Error loading content:", error);
  }
}

// Render experiments grid
function renderExperiments(experiments) {
  const grid = document.querySelector(".experiments-grid");
  if (!grid) return;

  grid.innerHTML = experiments
    .map(
      (exp) => `
    <a href="${exp.link}" class="experiment-card ${
        exp.image ? `card-${exp.id}` : ""
      }">
      <div class="card-content">
        <h3>${exp.title}</h3>
      </div>
    </a>
  `
    )
    .join("");
}

// Render articles by category
function renderArticles(articles) {
  const categories = ["technical", "essays", "blog"];

  categories.forEach((category) => {
    const container = document.querySelector(
      `.articles-container[data-category="${category}"]`
    );
    if (!container) return;

    const categoryArticles = articles
      .filter((article) => article.category === category)
      .sort((a, b) => b.date.localeCompare(a.date));

    const limit = INITIAL_ITEMS[category] || 1;

    container.innerHTML = categoryArticles
      .map(
        (article, index) => `
      <a href="articles/${article.id}.html" class="article-link ${
          index >= limit ? "hidden" : ""
        }">
        <h4>${article.title}</h4>
        <p>${article.description}</p>
      </a>
    `
      )
      .join("");

    // Show expand button if there are hidden items
    const hiddenCount = categoryArticles.length - limit;
    const expandBtn = document.querySelector(`[data-section="${category}"]`);
    if (expandBtn && hiddenCount > 0) {
      expandBtn.classList.add("show");
    }
  });
}

// Render projects
function renderProjects(projects) {
  const container = document.querySelector(".projects-container");
  if (!container) return;

  const sortedProjects = projects.sort((a, b) => {
    // Sort by date (most recent first)
    const dateA = a.date.includes("Present") ? "9999" : a.date;
    const dateB = b.date.includes("Present") ? "9999" : b.date;
    return dateB.localeCompare(dateA);
  });

  const limit = INITIAL_ITEMS.projects;

  container.innerHTML = sortedProjects
    .map(
      (project, index) => `
    <a href="${project.link}" class="timeline-item-link ${
        index >= limit ? "hidden" : ""
      }">
      <div class="timeline-item">
        <h3>${project.title}</h3>
        <div class="timeline-meta">
          ${project.date}${
        project.organization ? " • " + project.organization : ""
      }
        </div>
        <p>${project.description}</p>
        <div class="tags">
          ${project.tags
            .map((tag) => `<span class="tag">${tag}</span>`)
            .join("")}
        </div>
      </div>
    </a>
  `
    )
    .join("");

  // Show expand button if there are hidden items
  const hiddenCount = sortedProjects.length - limit;
  const expandBtn = document.querySelector('[data-section="projects"]');
  if (expandBtn && hiddenCount > 0) {
    expandBtn.classList.add("show");
  }
}

// Theme toggle functionality
function initializeTheme() {
  const themeToggle = document.querySelector(".theme-toggle");
  if (!themeToggle) return;

  const currentTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", currentTheme);

  themeToggle.addEventListener("click", () => {
    const theme = document.documentElement.getAttribute("data-theme");
    const newTheme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Handle expand button clicks
function setupExpandButtons() {
  const expandButtons = document.querySelectorAll(".expand-btn");

  expandButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const section = this.dataset.section;
      let container;

      if (section === "projects") {
        container = document.querySelector(".projects-container");
      } else {
        container = document.querySelector(
          `.articles-container[data-category="${section}"]`
        );
      }

      if (container) {
        const hiddenItems = container.querySelectorAll(".hidden");
        hiddenItems.forEach((item) => item.classList.remove("hidden"));
      }

      this.classList.remove("show");
      this.style.display = "none";
    });
  });
}

// Smooth scroll for anchor links
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        const headerOffset = 20;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition =
          elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    });
  });
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  initializeTheme();
  loadContent();
  setupExpandButtons();
  setupSmoothScroll();
});
