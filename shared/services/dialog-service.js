// shared/services/dialog-service.js

/**
 * Custom Promise-based Glassmorphic Dialog Modal (Replaces native alert/confirm)
 */
export function showConfirmDialog({
  title = "Confirmation",
  message = "Are you sure you want to perform this action?",
  icon = "❓",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger" // "danger" | "warning" | "info" | "primary"
} = {}) {
  return new Promise((resolve) => {
    // Remove existing dialog if any
    const existing = document.getElementById("auraCustomDialogOverlay");
    if (existing) existing.remove();

    const typeColors = {
      danger: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "#ef4444", btn: "background: #ef4444; color: white;" },
      warning: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)", text: "#f59e0b", btn: "background: #f59e0b; color: white;" },
      info: { bg: "rgba(99, 102, 241, 0.15)", border: "rgba(99, 102, 241, 0.4)", text: "#6366f1", btn: "background: #6366f1; color: white;" },
      primary: { bg: "rgba(99, 102, 241, 0.15)", border: "rgba(99, 102, 241, 0.4)", text: "#6366f1", btn: "background: var(--accent-gradient); color: white;" }
    };

    const style = typeColors[type] || typeColors.danger;

    const overlay = document.createElement("div");
    overlay.id = "auraCustomDialogOverlay";
    overlay.className = "modal-overlay active";
    overlay.style.zIndex = "99999";
    overlay.style.background = "rgba(11, 15, 25, 0.85)";
    overlay.style.backdropFilter = "blur(10px)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.25s ease";

    overlay.innerHTML = `
      <div class="modal-container" style="max-width: 440px; text-align: center; padding: 2rem; border-radius: var(--radius-lg); border: 1px solid ${style.border}; background: var(--bg-card); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.92); transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <!-- Icon Badge -->
        <div style="width: 64px; height: 64px; border-radius: 50%; background: ${style.bg}; border: 1px solid ${style.border}; color: ${style.text}; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 1.8rem; box-shadow: 0 0 20px ${style.bg};">
          ${icon}
        </div>

        <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem; letter-spacing: -0.01em;">
          ${title}
        </h3>

        <p style="color: var(--text-secondary); font-size: 0.92rem; line-height: 1.6; margin-bottom: 1.75rem;">
          ${message}
        </p>

        <div style="display: flex; gap: 0.75rem;">
          <button type="button" id="auraDialogCancelBtn" class="btn btn-secondary" style="flex: 1; justify-content: center; padding: 0.75rem;">
            ${cancelText}
          </button>
          <button type="button" id="auraDialogConfirmBtn" class="btn" style="flex: 1; justify-content: center; padding: 0.75rem; font-weight: 700; border: none; ${style.btn}">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animate In
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      const box = overlay.querySelector(".modal-container");
      if (box) box.style.transform = "scale(1)";
    });

    const cleanup = (result) => {
      overlay.style.opacity = "0";
      const box = overlay.querySelector(".modal-container");
      if (box) box.style.transform = "scale(0.92)";
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    document.getElementById("auraDialogConfirmBtn")?.addEventListener("click", () => cleanup(true));
    document.getElementById("auraDialogCancelBtn")?.addEventListener("click", () => cleanup(false));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

/**
 * Custom Alert Dialog (Single OK button)
 */
export function showAlertDialog({
  title = "Notice",
  message = "",
  icon = "ℹ️",
  buttonText = "Got it",
  type = "info"
} = {}) {
  return showConfirmDialog({
    title,
    message,
    icon,
    confirmText: buttonText,
    cancelText: "",
    type
  }).then(() => true);
}
