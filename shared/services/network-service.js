// shared/services/network-service.js - Real-time Network Connectivity Monitor

class NetworkMonitor {
  constructor() {
    this.bannerId = "aura-network-status-banner";
    this.isOffline = false;
    this.init();
  }

  init() {
    if (typeof window === "undefined") return;

    this.injectStyles();

    // Check initial state
    if (!navigator.onLine) {
      this.handleOffline();
    }

    // Listen to network changes
    window.addEventListener("offline", () => this.handleOffline());
    window.addEventListener("online", () => this.handleOnline());
  }

  injectStyles() {
    if (document.getElementById("aura-network-banner-styles")) return;
    const style = document.createElement("style");
    style.id = "aura-network-banner-styles";
    style.textContent = `
      #aura-network-status-banner {
        position: fixed;
        top: 14px;
        left: 50%;
        transform: translateX(-50%) translateY(-60px);
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.6rem 1.25rem;
        border-radius: 9999px;
        font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.01em;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.2);
        opacity: 0;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }

      #aura-network-status-banner.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }

      #aura-network-status-banner.offline {
        background: rgba(220, 38, 38, 0.92);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
      }

      #aura-network-status-banner.online {
        background: rgba(16, 185, 129, 0.92);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
      }

      .aura-network-pulse {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: white;
        position: relative;
      }

      .aura-network-pulse::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        background: white;
        opacity: 0.6;
        animation: auraPulse 1.4s infinite ease-in-out;
      }

      @keyframes auraPulse {
        0% { transform: scale(1); opacity: 0.7; }
        50% { transform: scale(1.8); opacity: 0; }
        100% { transform: scale(1); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  getBannerElement() {
    let banner = document.getElementById(this.bannerId);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = this.bannerId;
      banner.setAttribute("role", "alert");
      banner.setAttribute("aria-live", "assertive");
      document.body.appendChild(banner);
    }
    return banner;
  }

  handleOffline() {
    this.isOffline = true;
    const banner = this.getBannerElement();
    banner.className = "offline show";
    banner.innerHTML = `
      <span class="aura-network-pulse" style="background:#fef08a;"></span>
      <span>⚠️ <strong>Internet Not Working:</strong> You are currently offline. Check connection.</span>
    `;

    // Also trigger custom event if application wants to pause operations
    window.dispatchEvent(new CustomEvent("aura_network_status", { detail: { online: false } }));
  }

  handleOnline() {
    if (!this.isOffline) return; // Ignore if was already online
    this.isOffline = false;

    const banner = this.getBannerElement();
    banner.className = "online show";
    banner.innerHTML = `
      <span class="aura-network-pulse" style="background:#86efac;"></span>
      <span>⚡ <strong>Back Online:</strong> Internet connection restored!</span>
    `;

    window.dispatchEvent(new CustomEvent("aura_network_status", { detail: { online: true } }));

    // Auto-hide online confirmation after 3.5 seconds
    setTimeout(() => {
      if (!this.isOffline) {
        banner.classList.remove("show");
      }
    }, 3500);
  }
}

export const NetworkService = new NetworkMonitor();
