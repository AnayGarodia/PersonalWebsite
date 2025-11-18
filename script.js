// Configuration for how many items to show initially
const INITIAL_ITEMS = {
  projects: 3,
  technical: 1,
  essays: 2,
  blog: 1,
};

// Theme toggle functionality
function initializeTheme() {
  const themeToggle = document.querySelector(".theme-toggle");
  const currentTheme = localStorage.getItem("theme") || "light";

  document.documentElement.setAttribute("data-theme", currentTheme);

  themeToggle.addEventListener("click", () => {
    const theme = document.documentElement.getAttribute("data-theme");
    const newTheme = theme === "light" ? "dark" : "light";

    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  });
}

// Initialize expand buttons
function initializeExpandButtons() {
  // Projects
  const projectsContainer = document.querySelector(".projects-container");
  if (projectsContainer) {
    const hiddenProjects = projectsContainer.querySelectorAll(
      ".timeline-item-link.hidden"
    );
    const projectsBtn = document.querySelector('[data-section="projects"]');

    if (hiddenProjects.length > 0 && projectsBtn) {
      projectsBtn.classList.add("show");
    }
  }

  // Writing categories
  const categories = ["technical", "essays", "blog"];
  categories.forEach((category) => {
    const container = document.querySelector(
      `.articles-container[data-category="${category}"]`
    );
    if (container) {
      const hiddenArticles = container.querySelectorAll(".article-link.hidden");
      const btn = document.querySelector(`[data-section="${category}"]`);

      if (hiddenArticles.length > 0 && btn) {
        btn.classList.add("show");
      }
    }
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
        if (container) {
          const hiddenItems = container.querySelectorAll(
            ".timeline-item-link.hidden"
          );
          hiddenItems.forEach((item) => {
            item.classList.remove("hidden");
          });
        }
      } else {
        container = document.querySelector(
          `.articles-container[data-category="${section}"]`
        );
        if (container) {
          const hiddenItems = container.querySelectorAll(
            ".article-link.hidden"
          );
          hiddenItems.forEach((item) => {
            item.classList.remove("hidden");
          });
        }
      }

      // Hide the button after expanding
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

      // Skip if it's empty hash
      if (href === "#") {
        return;
      }

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
  initializeExpandButtons();
  setupExpandButtons();
  setupSmoothScroll();
});
