// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// Dark mode toggle (remembers the choice)
const themeToggle = document.getElementById("theme-toggle");
const root = document.documentElement;

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
}

let savedTheme = null;
try {
  savedTheme = localStorage.getItem("theme");
} catch (e) {}

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("theme", next);
  } catch (e) {}
});

// Mobile menu
const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");

menuToggle.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

navLinks.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  })
);

// Contact form (GitHub Pages is static, so there is no server to receive it)
const form = document.getElementById("contact-form");
const status = document.getElementById("form-status");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim();
  status.textContent = `Thanks, ${name}! Your message was received.`;
  form.reset();
});
