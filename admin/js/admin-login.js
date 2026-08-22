// admin/js/admin-login.js
import { AuthService } from "../../shared/services/auth-service.js";
import { NetworkService } from "../../shared/services/network-service.js";

function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️";
  toast.innerHTML = `<span style="font-size:1.1rem;">${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

document.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  setupPasswordToggle();
  setupLoginForm();
  checkExistingAdminSession();
});

function setupTheme() {
  const savedTheme = localStorage.getItem("aura_theme") || "dark";
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
  }
}

function setupPasswordToggle() {
  const toggleBtn = document.getElementById("togglePasswordBtn");
  const passwordInput = document.getElementById("adminPassword");

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      toggleBtn.textContent = isPassword ? "🙈" : "👁️";
    });
  }
}

function checkExistingAdminSession() {
  const currentUser = AuthService.getCurrentUser();
  if (currentUser && currentUser.isAdmin) {
    showToast(`Already authenticated as ${currentUser.displayName}. Redirecting...`, "info", 1200);
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 600);
  }
}

function setupLoginForm() {
  const form = document.getElementById("adminLoginForm");
  const submitBtn = document.getElementById("adminLoginBtn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("adminEmail")?.value.trim();
    const password = document.getElementById("adminPassword")?.value;

    if (!email || !password) {
      showToast("Please enter both administrator email and password.", "error");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; margin-right: 0.5rem;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
        Authenticating...
      `;
    }

    try {
      const user = await AuthService.login(email, password);

      if (!user.isAdmin) {
        showToast("Access Denied: This account is not registered with administrator privileges.", "error", 4000);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Sign In to Dashboard <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
        }
        return;
      }

      showToast(`Welcome back, ${user.displayName}! Opening Dashboard...`, "success", 1500);

      setTimeout(() => {
        window.location.href = "./index.html";
      }, 500);

    } catch (err) {
      showToast(err.message || "Failed to authenticate administrator.", "error", 4000);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `Sign In to Dashboard <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
      }
    }
  });
}
