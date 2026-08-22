// admin/js/admin.js
import { DBService } from "../../shared/services/db-service.js";
import { AuthService } from "../../shared/services/auth-service.js";
import { EmailService } from "../../shared/services/email-service.js";
import { CloudinaryService } from "../../shared/services/cloudinary-service.js";
import { showConfirmDialog, showAlertDialog } from "../../shared/services/dialog-service.js";
import { NetworkService } from "../../shared/services/network-service.js";

let productsList = [];
let ordersList = [];
let currentProductFilter = "";
let currentOrderStatusFilter = "ALL";

// Multi-Image State for Admin Form
let currentProductImages = [];
let cameraStream = null;

export function formatPKR(amount) {
  return "Rs. " + Number(amount || 0).toLocaleString("en-PK");
}

export function showToast(message, type = "info", duration = 3500) {
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

// ==================== MODAL CONTROLS ====================
function openProductModal(isEdit = false, product = null) {
  const modal = document.getElementById("productModalOverlay");
  const modalTitle = document.getElementById("productModalTitle");
  const form = document.getElementById("productForm");

  if (!modal) return;
  form?.reset();

  if (isEdit && product) {
    if (modalTitle) modalTitle.textContent = "Edit Product";
    const idEl = document.getElementById("formProductId");
    if (idEl) idEl.value = product.id;
    const titleEl = document.getElementById("formTitle");
    if (titleEl) titleEl.value = product.title;
    const catEl = document.getElementById("formCategory");
    if (catEl) catEl.value = product.category || "Audio";
    const badgeEl = document.getElementById("formBadge");
    if (badgeEl) badgeEl.value = product.badge || "New";
    const priceEl = document.getElementById("formPrice");
    if (priceEl) priceEl.value = product.price;
    const origPriceEl = document.getElementById("formOriginalPrice");
    if (origPriceEl) origPriceEl.value = product.originalPrice || "";
    const stockEl = document.getElementById("formStock");
    if (stockEl) stockEl.value = product.stock !== undefined ? product.stock : 20;
    const descEl = document.getElementById("formDescription");
    if (descEl) descEl.value = product.description;
    const featEl = document.getElementById("formFeatured");
    if (featEl) featEl.checked = Boolean(product.featured);

    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      currentProductImages = [...product.images];
    } else if (product.image) {
      currentProductImages = [product.image];
    } else {
      currentProductImages = [];
    }
  } else {
    if (modalTitle) modalTitle.textContent = "Add New Product to Firestore";
    const idInput = document.getElementById("formProductId");
    if (idInput) idInput.value = "";
    currentProductImages = [];
  }

  renderFormThumbnails();
  modal.classList.add("active");
}

function closeProductModal() {
  document.getElementById("productModalOverlay")?.classList.remove("active");
}

// Expose All Global Admin Handlers to Window IMMEDIATELY
window.adminOpenAddProduct = () => openProductModal(false);
window.closeProductModal = closeProductModal;

window.adminEditProduct = (id) => {
  const product = productsList.find(p => String(p.id) === String(id));
  if (product) openProductModal(true, product);
};

window.adminDeleteProduct = async (id) => {
  const product = productsList.find(p => String(p.id) === String(id));
  if (!product) return;

  const confirmDelete = await showConfirmDialog({
    title: "Delete Product",
    message: `Are you sure you want to permanently delete "${product.title}" from Cloud Firestore inventory?`,
    icon: "🗑️",
    confirmText: "Delete Product",
    cancelText: "Cancel",
    type: "danger"
  });

  if (confirmDelete) {
    try {
      await DBService.deleteProduct(id);
      showToast(`Deleted "${product.title}" successfully`, "info");
      await refreshAllData();
    } catch (e) {
      showToast("Failed to delete product: " + e.message, "error");
    }
  }
};

window.adminSetCoverImage = (index) => {
  if (index >= 0 && index < currentProductImages.length) {
    const selected = currentProductImages.splice(index, 1)[0];
    currentProductImages.unshift(selected);
    renderFormThumbnails();
  }
};

window.adminRemoveGalleryImage = (index) => {
  if (index >= 0 && index < currentProductImages.length) {
    currentProductImages.splice(index, 1);
    renderFormThumbnails();
  }
};

// ==================== LIVE EMAIL DISPATCH DIALOG ====================
export function showLiveEmailDispatchModal(detail) {
  // Close order details modal if open to prevent stacking
  document.getElementById("adminOrderDetailsModalOverlay")?.classList.remove("active");

  const modal = document.getElementById("adminEmailDispatchModalOverlay");
  if (modal) {
    const recipientEl = document.getElementById("emailModalRecipient");
    const statusBadgeEl = document.getElementById("emailModalStatusBadge");
    const subjectEl = document.getElementById("emailModalSubject");
    const previewEl = document.getElementById("emailModalPreviewContainer");
    const gmailBtn = document.getElementById("emailModalGmailWebBtn");
    const mailtoBtn = document.getElementById("emailModalOpenMailtoBtn");
    const copyBtn = document.getElementById("emailModalCopyTemplateBtn");
    const closeBtn = document.getElementById("closeAdminEmailModalBtn");

    if (recipientEl) recipientEl.textContent = `${detail.customerName || 'Customer'} <${detail.to}>`;
    if (statusBadgeEl) {
      statusBadgeEl.textContent = detail.status;
      statusBadgeEl.className = `status-badge status-${(detail.status || 'pending').toLowerCase()}`;
    }
    if (subjectEl) subjectEl.textContent = detail.subject;
    if (previewEl) previewEl.innerHTML = detail.html;

    if (gmailBtn) {
      gmailBtn.href = detail.gmailWebUrl;
    }
    if (mailtoBtn) {
      mailtoBtn.href = detail.mailtoUrl;
    }

    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(detail.plainText || detail.html);
          showToast("📋 Status email template copied to clipboard!", "success");
          copyBtn.textContent = "✓ Copied!";
          setTimeout(() => {
            copyBtn.innerHTML = "<span>📋 Copy Template</span>";
          }, 2000);
        } catch (err) {
          showToast("Could not copy to clipboard", "warning");
        }
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.remove("active");
    }

    modal.style.zIndex = "999999";
    modal.classList.add("active");
  } else {
    // Fallback Alert Dialog
    showAlertDialog({
      title: `✉️ Dispatch Email: Order #${detail.orderId}`,
      message: `Status: [${detail.status}]\nRecipient: ${detail.to}\nSubject: ${detail.subject}\n\nEmail notification generated successfully.`,
      icon: "✉️",
      buttonText: "Open Gmail Compose",
      type: "info"
    }).then((confirmed) => {
      if (confirmed && detail.gmailWebUrl) {
        window.open(detail.gmailWebUrl, "_blank");
      }
    });
  }
}

window.addEventListener("aura_email_dispatched", (e) => {
  if (e.detail) {
    showLiveEmailDispatchModal(e.detail);
    showToast(`✉️ Live Email Dispatcher ready for ${e.detail.customerName || 'Customer'}!`, "success", 4000);
  }
});

window.adminSendOrderEmail = async (orderId) => {
  let order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) {
    try {
      const all = await DBService.getOrders();
      order = all.find(o => String(o.id) === String(orderId));
    } catch (e) { }
  }

  if (!order) {
    showToast(`Order #${orderId} not found in records.`, "warning");
    return;
  }

  showToast(`📧 Opening live email dialog for Order #${order.id}...`, "info", 1500);
  await EmailService.sendOrderStatusEmail(order, order.status || "Processing");
};

window.adminChangeOrderStatus = async (orderId, newStatus) => {
  try {
    const updated = await DBService.updateOrderStatus(orderId, newStatus);
    const targetOrder = ordersList.find(o => String(o.id) === String(orderId)) || updated;

    if (targetOrder) {
      await EmailService.sendOrderStatusEmail(targetOrder, newStatus);
      showToast(`✉️ Order #${orderId} marked as "${newStatus}"`, "success");
    } else {
      showToast(`Order #${orderId} status updated to "${newStatus}"`, "success");
    }

    await refreshAllData();
  } catch (e) {
    showToast("Failed to update order status: " + e.message, "error");
  }
};
window.adminUpdateOrderStatus = window.adminChangeOrderStatus;

window.adminDeleteOrder = async (orderId) => {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const confirmDelete = await showConfirmDialog({
    title: "Delete Order",
    message: `Are you sure you want to permanently delete Order #${orderId} (${order.customer?.name || 'Customer'}) from Cloud Firestore?`,
    icon: "📦",
    confirmText: "Delete Order",
    cancelText: "Cancel",
    type: "danger"
  });

  if (confirmDelete) {
    try {
      await DBService.deleteOrder(orderId, order.customer?.userId);
      showToast(`🗑️ Order #${orderId} deleted permanently from Firestore!`, "info");
      await refreshAllData();
    } catch (e) {
      showToast("Failed to delete order: " + e.message, "error");
    }
  }
};

window.adminViewOrder = (orderId) => {
  const order = ordersList.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const modal = document.getElementById("adminOrderDetailsModalOverlay");
  const modalBody = document.getElementById("adminOrderDetailsBody");
  const modalTitle = document.getElementById("adminOrderDetailsTitle");

  if (!modal || !modalBody) return;

  if (modalTitle) modalTitle.textContent = `Order Details: #${order.id}`;

  modalBody.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--glass-border);">
      <div>
        <div style="font-size:0.8rem; color:var(--text-muted);">Placed On</div>
        <strong>${new Date(order.createdAt).toLocaleString()}</strong>
      </div>
      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.2rem;">Current Status</div>
        <span class="status-badge status-${(order.status || 'pending').toLowerCase()}">${order.status}</span>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem; margin-bottom:1.5rem;">
      <div style="background:var(--bg-card); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--glass-border);">
        <h5 style="color:var(--primary); margin-bottom:0.5rem; font-size:0.85rem; text-transform:uppercase;">Customer Profile</h5>
        <div><strong>${order.customer?.name}</strong></div>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${order.customer?.email}</div>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${order.customer?.phone || 'No phone provided'}</div>
      </div>

      <div style="background:var(--bg-card); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--glass-border);">
        <h5 style="color:var(--primary); margin-bottom:0.5rem; font-size:0.85rem; text-transform:uppercase;">Delivery & Payment</h5>
        <div style="font-size:0.85rem; margin-bottom:0.35rem;"><strong>Address:</strong> ${order.customer?.address}</div>
        <div style="font-size:0.85rem;"><strong>Payment Method:</strong> ${order.paymentMethod || 'Credit Card'}</div>
      </div>
    </div>

    <h5 style="margin-bottom:0.75rem; font-size:0.95rem;">Purchased Items</h5>
    <div style="background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--glass-border); overflow:hidden; margin-bottom:1.25rem;">
      ${(order.items || []).map(item => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 1rem; border-bottom:1px solid var(--glass-border);">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${item.image || ''}" alt="${item.title}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
            <div>
              <div style="font-weight:600; font-size:0.9rem;">${item.title}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">Qty: ${item.quantity} × ${formatPKR(item.price)}</div>
            </div>
          </div>
          <strong style="font-size:0.95rem;">${formatPKR(item.price * item.quantity)}</strong>
        </div>
      `).join("")}
    </div>

    <div style="padding:1rem; background:var(--bg-elevated); border-radius:var(--radius-md); font-size:0.9rem; margin-bottom:1.25rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
        <span>Subtotal:</span>
        <span>${formatPKR(order.subtotal || 0)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem;">
        <span>Shipping:</span>
        <span>${order.shipping === 0 ? 'FREE' : formatPKR(order.shipping || 0)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:0.3rem; color:var(--success);">
        <span>Discount:</span>
        <span>-${formatPKR(order.discount || 0)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; border-top:1px solid var(--glass-border); padding-top:0.5rem; margin-top:0.5rem;">
        <span>Total Paid:</span>
        <span style="color:var(--primary);">${formatPKR(order.total || 0)}</span>
      </div>
    </div>

    <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
      <button type="button" class="btn btn-secondary" onclick="document.getElementById('adminOrderDetailsModalOverlay')?.classList.remove('active')">
        Close
      </button>
      <button type="button" class="btn btn-primary" onclick="window.adminSendOrderEmail('${order.id}')" style="gap:0.4rem;">
        <span>✉️ Dispatch Status Email</span>
      </button>
    </div>
  `;

  modal.classList.add("active");
};

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", async () => {
  initAdminTheme();
  AuthService.init();
  renderSkeletons();
  setupNavigation();
  setupEventListeners();
  loadAdminProfileFromFirestore();
  setupAdminAuthGuard();
  initAdminGSAP();
});

async function loadAdminProfileFromFirestore() {
  const nameEl = document.getElementById("adminSidebarName");
  const emailEl = document.getElementById("adminSidebarEmail");
  const avatarEl = document.getElementById("adminSidebarAvatar");

  try {
    const adminData = await DBService.getAdminProfile();
    if (adminData) {
      if (nameEl) nameEl.textContent = adminData.name || adminData.displayName || "Administrator";
      if (emailEl) emailEl.textContent = adminData.email || "admin@gmail.com";
      if (avatarEl) avatarEl.src = adminData.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${adminData.email || 'admin'}`;
    }
  } catch (e) {
    console.warn("Direct Firestore admin load error:", e);
  }
}

function initAdminGSAP() {
  if (typeof gsap === "undefined") return;

  gsap.from(".admin-sidebar", {
    x: -30,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out"
  });

  gsap.from(".admin-topbar", {
    y: -20,
    opacity: 0,
    duration: 0.5,
    ease: "power3.out",
    delay: 0.05
  });
}

function initAdminTheme() {
  const savedTheme = localStorage.getItem("aura_theme") || "dark";
  if (savedTheme === "light") {
    document.documentElement.classList.add("light-theme");
    document.body.classList.add("light-theme");
  } else {
    document.documentElement.classList.remove("light-theme");
    document.body.classList.remove("light-theme");
  }
}

// ==================== NAVIGATION ====================
function setupNavigation() {
  const navLinks = document.querySelectorAll(".sidebar-link[data-section]");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      const targetSection = link.dataset.section;
      const overviewView = document.getElementById("adminOverviewView");
      const productsView = document.getElementById("adminProductsView");
      const ordersView = document.getElementById("adminOrdersView");
      const announcementView = document.getElementById("adminAnnouncementView");

      const activeView = targetSection === "overviewSection" ? overviewView
        : targetSection === "productsSection" ? productsView
          : targetSection === "ordersSection" ? ordersView
            : announcementView;

      if (overviewView) overviewView.style.display = targetSection === "overviewSection" ? "block" : "none";
      if (productsView) productsView.style.display = targetSection === "productsSection" ? "block" : "none";
      if (ordersView) ordersView.style.display = targetSection === "ordersSection" ? "block" : "none";
      if (announcementView) announcementView.style.display = targetSection === "announcementSection" ? "block" : "none";

      if (typeof gsap !== "undefined" && activeView) {
        gsap.fromTo(activeView,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }
        );
      }
    });
  });

  document.getElementById("adminThemeToggle")?.addEventListener("click", () => {
    const isLight = document.documentElement.classList.toggle("light-theme");
    document.body.classList.toggle("light-theme", isLight);
    localStorage.setItem("aura_theme", isLight ? "light" : "dark");
  });
}

// ==================== SKELETON LOADING & SYNC SYSTEM ====================
function updateSyncStatusBanner(isSyncing, message = "") {
  let banner = document.getElementById("adminSyncStatusFloatingBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "adminSyncStatusFloatingBanner";
    banner.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 50px;
      padding: 0.65rem 1.35rem;
      color: #ffffff;
      font-size: 0.86rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 10px 35px rgba(0,0,0,0.6), 0 0 25px rgba(56, 189, 248, 0.25);
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      transform: translateY(100px);
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(banner);
  }

  if (isSyncing) {
    banner.innerHTML = `
      <svg style="animation: spin 1s linear infinite; color:#38bdf8;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>${message || '⚡ Connecting to Cloud Firestore... Fetching live store data'}</span>
    `;
    banner.style.transform = "translateY(0)";
    banner.style.opacity = "1";
    banner.style.borderColor = "rgba(56, 189, 248, 0.4)";
  } else {
    banner.innerHTML = `
      <span style="color:#10b981; font-size:1.1rem; font-weight:900;">✓</span>
      <span style="color:#f8fafc;">${message || 'Cloud Firestore data synchronized!'}</span>
    `;
    banner.style.transform = "translateY(0)";
    banner.style.opacity = "1";
    banner.style.borderColor = "rgba(16, 185, 129, 0.4)";

    setTimeout(() => {
      banner.style.transform = "translateY(100px)";
      banner.style.opacity = "0";
    }, 2800);
  }
}

function renderSkeletons() {
  // 1. KPI Skeletons
  const revEl = document.getElementById("kpiTotalRevenue");
  const ordEl = document.getElementById("kpiTotalOrders");
  const prdEl = document.getElementById("kpiTotalProducts");
  const pndEl = document.getElementById("kpiPendingOrders");

  if (revEl && (!productsList.length && !ordersList.length)) revEl.innerHTML = `<span class="skeleton-box skeleton-kpi"></span>`;
  if (ordEl && (!productsList.length && !ordersList.length)) ordEl.innerHTML = `<span class="skeleton-box skeleton-kpi" style="width:70px;"></span>`;
  if (prdEl && (!productsList.length && !ordersList.length)) prdEl.innerHTML = `<span class="skeleton-box skeleton-kpi" style="width:70px;"></span>`;
  if (pndEl && (!productsList.length && !ordersList.length)) pndEl.innerHTML = `<span class="skeleton-box skeleton-kpi" style="width:70px;"></span>`;

  // 2. Recent Orders Table Skeleton
  const recentTbody = document.getElementById("overviewRecentOrdersTbody");
  if (recentTbody && !ordersList.length) {
    recentTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 1.25rem 1rem !important; background: rgba(56, 189, 248, 0.04); border-bottom: 1px solid var(--glass-border);">
          <div style="display:flex; align-items:center; justify-content:center; gap:0.6rem; color: #38bdf8; font-weight:700; font-size:0.88rem;">
            <svg style="animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Connecting to Cloud Firestore... Fetching recent orders</span>
          </div>
        </td>
      </tr>
    ` + Array.from({ length: 3 }).map(() => `
      <tr class="skeleton-tr">
        <td><span class="skeleton-box" style="width:85px; height:16px;"></span></td>
        <td>
          <span class="skeleton-box" style="width:130px; height:15px; display:block; margin-bottom:4px;"></span>
          <span class="skeleton-box" style="width:90px; height:12px;"></span>
        </td>
        <td><span class="skeleton-box" style="width:80px; height:14px;"></span></td>
        <td><span class="skeleton-box" style="width:95px; height:16px;"></span></td>
        <td><span class="skeleton-box" style="width:75px; height:24px; border-radius:20px;"></span></td>
        <td><span class="skeleton-box" style="width:50px; height:28px; border-radius:6px; float:right;"></span></td>
      </tr>
    `).join("");
  }

  // 3. Products Catalog Table Skeleton
  const productsTbody = document.getElementById("productsTableTbody");
  if (productsTbody && !productsList.length) {
    productsTbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 1.25rem 1rem !important; background: rgba(56, 189, 248, 0.04); border-bottom: 1px solid var(--glass-border);">
          <div style="display:flex; align-items:center; justify-content:center; gap:0.6rem; color: #38bdf8; font-weight:700; font-size:0.88rem;">
            <svg style="animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Connecting to Cloud Firestore... Loading products inventory</span>
          </div>
        </td>
      </tr>
    ` + Array.from({ length: 4 }).map(() => `
      <tr class="skeleton-tr">
        <td>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="skeleton-box" style="width:44px; height:44px; border-radius:8px; flex-shrink:0;"></span>
            <div style="flex:1;">
              <span class="skeleton-box" style="width:140px; height:16px; display:block; margin-bottom:4px;"></span>
              <span class="skeleton-box" style="width:80px; height:12px;"></span>
            </div>
          </div>
        </td>
        <td><span class="skeleton-box" style="width:80px; height:22px; border-radius:6px;"></span></td>
        <td><span class="skeleton-box" style="width:90px; height:16px;"></span></td>
        <td><span class="skeleton-box" style="width:75px; height:16px;"></span></td>
        <td><span class="skeleton-box" style="width:90px; height:16px;"></span></td>
        <td><span class="skeleton-box" style="width:40px; height:16px;"></span></td>
        <td style="text-align:right;"><span class="skeleton-box" style="width:65px; height:28px; border-radius:6px;"></span></td>
      </tr>
    `).join("");
  }

  // 4. Orders Management Table Skeleton
  const ordersTbody = document.getElementById("ordersTableTbody");
  if (ordersTbody && !ordersList.length) {
    ordersTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 1.25rem 1rem !important; background: rgba(56, 189, 248, 0.04); border-bottom: 1px solid var(--glass-border);">
          <div style="display:flex; align-items:center; justify-content:center; gap:0.6rem; color: #38bdf8; font-weight:700; font-size:0.88rem;">
            <svg style="animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Connecting to Cloud Firestore... Loading customer orders</span>
          </div>
        </td>
      </tr>
    ` + Array.from({ length: 4 }).map(() => `
      <tr class="skeleton-tr">
        <td>
          <span class="skeleton-box" style="width:90px; height:16px; display:block; margin-bottom:4px;"></span>
          <span class="skeleton-box" style="width:70px; height:12px;"></span>
        </td>
        <td>
          <span class="skeleton-box" style="width:130px; height:16px; display:block; margin-bottom:4px;"></span>
          <span class="skeleton-box" style="width:100px; height:13px; display:block; margin-bottom:2px;"></span>
          <span class="skeleton-box" style="width:80px; height:12px;"></span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="skeleton-box" style="width:36px; height:36px; border-radius:6px; flex-shrink:0;"></span>
            <div>
              <span class="skeleton-box" style="width:110px; height:14px; display:block; margin-bottom:3px;"></span>
              <span class="skeleton-box" style="width:65px; height:12px;"></span>
            </div>
          </div>
        </td>
        <td>
          <span class="skeleton-box" style="width:95px; height:16px; display:block; margin-bottom:4px;"></span>
          <span class="skeleton-box" style="width:60px; height:12px;"></span>
        </td>
        <td><span class="skeleton-box" style="width:100px; height:30px; border-radius:6px;"></span></td>
        <td style="text-align:right;"><span class="skeleton-box" style="width:70px; height:28px; border-radius:6px;"></span></td>
      </tr>
    `).join("");
  }
}

let hasInitialDataLoaded = false;

// ==================== DATA SYNC & RENDERING ====================
async function refreshAllData({ showBanner = false, silent = false } = {}) {
  const shouldShowBanner = showBanner || (!hasInitialDataLoaded && !silent);

  if (shouldShowBanner) {
    updateSyncStatusBanner(true, "Fetching live products & orders");
  }

  try {
    try {
      await loadAdminProfileFromFirestore();
    } catch (e) { }

    try {
      productsList = await DBService.getProducts();
    } catch (e) {
      productsList = [];
    }

    try {
      ordersList = await DBService.getOrders();
    } catch (e) {
      ordersList = [];
    }

    updateKPIs();
    renderOverviewRecentOrders();
    renderProductsTable();
    renderOrdersTable();

    try {
      await loadAnnouncementAdminSettings();
      await loadPromoBannerAdminSettings();
      await loadFlashDealAdminSettings();
    } catch (e) { }

    if (shouldShowBanner) {
      updateSyncStatusBanner(false, `✅ Firestore Synced (${productsList.length} products, ${ordersList.length} orders)`);
    }

    hasInitialDataLoaded = true;
  } catch (err) {
    console.warn("Admin data sync notice (using cached data):", err);
    if (shouldShowBanner) {
      updateSyncStatusBanner(false, "✓ Synced with local cache");
    }
  }
}

function updateKPIs() {
  const totalRevenue = ordersList.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = ordersList.length;
  const totalProducts = productsList.length;
  const pendingOrders = ordersList.filter(o => o.status === "Pending" || o.status === "Processing").length;

  const revEl = document.getElementById("kpiTotalRevenue");
  const ordEl = document.getElementById("kpiTotalOrders");
  const prdEl = document.getElementById("kpiTotalProducts");
  const pndEl = document.getElementById("kpiPendingOrders");

  if (revEl) revEl.textContent = formatPKR(totalRevenue);
  if (ordEl) ordEl.textContent = totalOrders;
  if (prdEl) prdEl.textContent = totalProducts;
  if (pndEl) pndEl.textContent = pendingOrders;
}

function renderOverviewRecentOrders() {
  const tbody = document.getElementById("overviewRecentOrdersTbody");
  if (!tbody) return;

  const recent = ordersList.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color:var(--text-muted);">No customer orders recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(order => `
    <tr>
      <td><strong style="color:var(--primary);">#${order.id}</strong></td>
      <td>
        <div><strong>${order.customer?.name || 'Customer'}</strong></div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${order.customer?.email || ''}</div>
      </td>
      <td>${new Date(order.createdAt).toLocaleDateString()}</td>
      <td><strong>${formatPKR(order.total || 0)}</strong></td>
      <td><span class="status-badge status-${(order.status || 'pending').toLowerCase()}">${order.status || 'Pending'}</span></td>
      <td>
        <div style="display:flex; gap:0.4rem; justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="window.adminViewOrder('${order.id}')" title="View Order">View</button>
          <button class="table-action-btn delete-btn" onclick="window.adminDeleteOrder('${order.id}')" title="Delete Order" style="color:var(--danger);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ==================== ORDERS MANAGEMENT TABLE ====================
function renderOrdersTable() {
  const tbody = document.getElementById("ordersTableTbody");
  if (!tbody) return;

  let filtered = [...ordersList];

  // Filter by status dropdown
  if (currentOrderStatusFilter && currentOrderStatusFilter !== "ALL") {
    filtered = filtered.filter(o => (o.status || "Pending").toLowerCase() === currentOrderStatusFilter.toLowerCase());
  }

  // Filter by search query
  if (currentProductFilter && currentProductFilter.trim()) {
    const q = currentProductFilter.toLowerCase().trim();
    filtered = filtered.filter(o =>
      String(o.id).toLowerCase().includes(q) ||
      (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
      (o.customer?.email && o.customer.email.toLowerCase().includes(q)) ||
      (o.customer?.phone && o.customer.phone.toLowerCase().includes(q)) ||
      (o.items && o.items.some(item => item.title && item.title.toLowerCase().includes(q)))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:1.75rem; margin-bottom:0.5rem;">📦</div>
          <strong style="color:var(--text-primary); font-size:1rem; display:block; margin-bottom:0.25rem;">No Orders Found</strong>
          <span>No customer orders match the selected filter.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => {
    const itemsList = order.items || [];
    const itemsHtml = itemsList.length > 0
      ? itemsList.map(item => `
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.35rem;">
            <img src="${item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'}" alt="${item.title || 'Product'}" style="width:34px; height:34px; border-radius:6px; object-fit:cover; border:1px solid var(--glass-border); flex-shrink:0;" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'">
            <div style="max-width:240px; overflow:hidden;">
              <div style="font-size:0.82rem; font-weight:600; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">${item.title || 'Product Item'}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${item.quantity || 1} × ${formatPKR(item.price || 0)}</div>
            </div>
          </div>
        `).join("")
      : `<span style="color:var(--text-muted); font-size:0.8rem;">No items attached</span>`;

    return `
      <tr>
        <td>
          <strong style="color:var(--primary); font-size:0.95rem;">#${order.id}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.2rem;">${new Date(order.createdAt || Date.now()).toLocaleDateString()}</div>
        </td>
        <td>
          <div><strong>${order.customer?.name || 'Customer'}</strong></div>
          <div style="font-size:0.8rem; color:var(--text-secondary);">${order.customer?.phone || 'No phone'}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${order.customer?.email || ''}</div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column;">
            ${itemsHtml}
          </div>
        </td>
        <td>
          <strong style="font-size:0.95rem;">${formatPKR(order.total || 0)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.15rem;">${order.paymentMethod || 'Cash on Delivery'}</div>
        </td>
        <td>
          <select class="form-select" style="font-size:0.8rem; padding:0.35rem 0.6rem; width:auto; border-radius:6px;" onchange="window.adminChangeOrderStatus('${order.id}', this.value)">
            <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
            <option value="Processing" ${order.status === 'Processing' ? 'selected' : ''}>⚙️ Processing</option>
            <option value="Shipped" ${order.status === 'Shipped' ? 'selected' : ''}>🚚 Shipped</option>
            <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>✅ Delivered</option>
            <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>❌ Cancelled</option>
          </select>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; gap:0.4rem; justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="window.adminViewOrder('${order.id}')" title="View Full Order Details">
              View
            </button>
            <button class="table-action-btn delete-btn" onclick="window.adminDeleteOrder('${order.id}')" title="Delete Order" style="color:var(--danger);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ==================== PRODUCTS CRUD ====================
function renderProductsTable() {
  const tbody = document.getElementById("productsTableTbody");
  if (!tbody) return;

  let filtered = [...productsList];
  if (currentProductFilter.trim()) {
    const q = currentProductFilter.toLowerCase().trim();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q)));
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <div style="font-size:1.75rem; margin-bottom:0.5rem;">🛍️</div>
          <strong style="color:var(--text-primary); font-size:1rem; display:block; margin-bottom:0.25rem;">No Products in Catalog</strong>
          <span>Click "+ Add Product" button to create your first product.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(product => `
    <tr>
      <td>
        <div class="table-product-cell">
          <img src="${product.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'}" alt="${product.title}" class="table-img" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'">
          <div>
            <strong>${product.title}</strong>
            ${product.badge ? `<span style="display:inline-block; font-size:0.7rem; color:var(--accent); margin-left:0.3rem;">[${product.badge}]</span>` : ''}
          </div>
        </div>
      </td>
      <td><span class="product-category">${product.category || 'General'}</span></td>
      <td><strong>${formatPKR(product.price)}</strong></td>
      <td>
        <span style="font-weight:600; color:${product.stock > 5 ? 'var(--success)' : (product.stock > 0 ? 'var(--warning)' : 'var(--danger)')};">
          ${product.stock} in stock
        </span>
      </td>
      <td>${product.reviewsCount > 0 ? `★ ${product.rating} (${product.reviewsCount})` : `<span style="color:var(--text-muted); font-size:0.8rem;">No reviews yet</span>`}</td>
      <td>${product.featured ? '⭐ Yes' : '—'}</td>
      <td style="text-align:right;">
        <div class="table-actions" style="justify-content: flex-end;">
          <button class="table-action-btn" onclick="window.adminEditProduct('${product.id}')" title="Edit Product">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </button>
          <button class="table-action-btn delete-btn" onclick="window.adminDeleteProduct('${product.id}')" title="Delete Product">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderFormThumbnails() {
  const container = document.getElementById("formImageThumbnailsGrid");
  const countBadge = document.getElementById("imageCountBadge");
  const mainImageHidden = document.getElementById("formMainImageHidden");

  if (!container) return;

  if (countBadge) {
    countBadge.textContent = `${currentProductImages.length} image${currentProductImages.length === 1 ? '' : 's'} attached`;
  }
  if (mainImageHidden) {
    mainImageHidden.value = currentProductImages[0] || "";
  }

  if (currentProductImages.length === 0) {
    container.innerHTML = `
      <div id="formNoImagesNotice" style="grid-column: 1 / -1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.8rem; padding:1.25rem 0;">
        <span>🖼️ No images added yet.</span>
        <span style="font-size:0.75rem; margin-top:0.25rem;">Pick files from computer or snap live photos with camera.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = currentProductImages.map((imgUrl, idx) => `
    <div style="position:relative; aspect-ratio:1; border-radius:6px; overflow:hidden; border:${idx === 0 ? '2px solid var(--primary)' : '1px solid var(--glass-border)'}; background:var(--bg-elevated); box-shadow:var(--shadow-sm);">
      <img src="${imgUrl}" alt="Gallery ${idx + 1}" style="width:100%; height:100%; object-fit:cover;">
      
      ${idx === 0 ? `
        <span style="position:absolute; top:2px; left:2px; background:var(--primary); color:white; font-size:0.6rem; font-weight:700; padding:1px 4px; border-radius:3px; text-transform:uppercase;">
          Cover
        </span>
      ` : `
        <button type="button" onclick="window.adminSetCoverImage(${idx})" title="Set as Cover Image" style="position:absolute; top:2px; left:2px; background:rgba(0,0,0,0.65); color:white; border:none; font-size:0.65rem; border-radius:3px; padding:2px 4px; cursor:pointer;">
          ★ Set
        </button>
      `}

      <button type="button" onclick="window.adminRemoveGalleryImage(${idx})" title="Remove Image" style="position:absolute; top:2px; right:2px; background:rgba(239,68,68,0.85); color:white; border:none; width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.65rem; cursor:pointer;">
        ✕
      </button>
    </div>
  `).join("");
}

// ==================== ANNOUNCEMENT BAR ADMIN CONTROLS ====================
let currentAnnouncementData = {
  enabled: false,
  badge: "FLASH OFFER",
  text: "Use code <strong>AURA10</strong> for 10% OFF • 🚀 Free Same-Day Express Dispatch in Pakistan",
  gradient: "linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f97316 100%)"
};

async function loadAnnouncementAdminSettings() {
  try {
    const data = await DBService.getAnnouncement();
    if (data) {
      currentAnnouncementData = { ...currentAnnouncementData, ...data };
    }
    populateAnnouncementForm();
    updateLivePreviewUI();
  } catch (err) {
    console.warn("Failed to load announcement admin settings:", err);
  }
}

function populateAnnouncementForm() {
  const toggle = document.getElementById("announcementEnabledToggle");
  const badgeInput = document.getElementById("announcementBadgeInput");
  const textInput = document.getElementById("announcementTextInput");
  const gradientSelect = document.getElementById("announcementGradientSelect");

  if (toggle) toggle.checked = Boolean(currentAnnouncementData.enabled);
  if (badgeInput) badgeInput.value = currentAnnouncementData.badge || "";
  if (textInput) textInput.value = currentAnnouncementData.text || "";
  if (gradientSelect && currentAnnouncementData.gradient) {
    gradientSelect.value = currentAnnouncementData.gradient;
  }
}

function updateLivePreviewUI() {
  const toggle = document.getElementById("announcementEnabledToggle");
  const badgeInput = document.getElementById("announcementBadgeInput");
  const textInput = document.getElementById("announcementTextInput");
  const gradientSelect = document.getElementById("announcementGradientSelect");

  const previewBox = document.getElementById("adminAnnouncementLivePreview");
  const previewBadge = document.getElementById("adminPreviewBadge");
  const previewText = document.getElementById("adminPreviewText");
  const statusIndicator = document.getElementById("announcementStatusIndicator");
  const toggleSlider = document.getElementById("toggleSliderSpan");

  const isEnabled = toggle ? toggle.checked : false;
  const badgeVal = badgeInput ? badgeInput.value.trim() : "";
  const textVal = textInput ? textInput.value.trim() : "";
  const gradVal = gradientSelect ? gradientSelect.value : "linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f97316 100%)";

  if (toggleSlider) {
    toggleSlider.style.backgroundColor = isEnabled ? "var(--primary)" : "#374151";
  }

  if (statusIndicator) {
    if (isEnabled) {
      statusIndicator.style.background = "rgba(34, 197, 94, 0.15)";
      statusIndicator.style.color = "#22c55e";
      statusIndicator.style.borderColor = "rgba(34, 197, 94, 0.3)";
      statusIndicator.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span><span>STATUS: LIVE & VISIBLE ON STORE</span>';
    } else {
      statusIndicator.style.background = "rgba(239, 68, 68, 0.15)";
      statusIndicator.style.color = "#ef4444";
      statusIndicator.style.borderColor = "rgba(239, 68, 68, 0.3)";
      statusIndicator.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#ef4444;"></span><span>STATUS: HIDDEN / OFF</span>';
    }
  }

  if (previewBox) {
    previewBox.style.background = gradVal;
    if (!isEnabled) {
      previewBox.style.opacity = "0.45";
      previewBox.style.filter = "grayscale(60%)";
    } else {
      previewBox.style.opacity = "1";
      previewBox.style.filter = "none";
    }
  }

  if (previewBadge) {
    if (badgeVal) {
      previewBadge.textContent = badgeVal;
      previewBadge.style.display = "inline-block";
    } else {
      previewBadge.style.display = "none";
    }
  }

  if (previewText) {
    previewText.innerHTML = textVal || '<em style="opacity:0.7;">(Enter announcement message below...)</em>';
  }
}

// ==================== PROMOTIONAL DISCOUNT BANNER ADMIN SYSTEM ====================
let currentPromoBannerData = {
  enabled: false,
  badge: "🔥 Exclusive Limited Time Offer",
  title: "Unlock 10% Off Your Entire Cart",
  description: "Use coupon code AURA10 during checkout for instant savings.",
  couponCode: "AURA10",
  buttonText: "Start Shopping Now"
};

async function loadPromoBannerAdminSettings() {
  try {
    const data = await DBService.getPromoBanner();
    if (data) {
      currentPromoBannerData = { ...currentPromoBannerData, ...data };
    }
    populatePromoBannerForm();
    updatePromoLivePreviewUI();
  } catch (err) {
    console.warn("Failed to load promo banner admin settings:", err);
  }
}

function populatePromoBannerForm() {
  const toggle = document.getElementById("promoBannerEnabledToggle");
  const badgeInput = document.getElementById("promoBannerBadgeInput");
  const couponInput = document.getElementById("promoBannerCouponInput");
  const titleInput = document.getElementById("promoBannerTitleInput");
  const descInput = document.getElementById("promoBannerDescInput");
  const btnTextInput = document.getElementById("promoBannerBtnTextInput");

  if (toggle) toggle.checked = Boolean(currentPromoBannerData.enabled);
  if (badgeInput) badgeInput.value = currentPromoBannerData.badge || "";
  if (couponInput) couponInput.value = currentPromoBannerData.couponCode || "AURA10";
  if (titleInput) titleInput.value = currentPromoBannerData.title || "";
  if (descInput) descInput.value = currentPromoBannerData.description || "";
  if (btnTextInput) btnTextInput.value = currentPromoBannerData.buttonText || "Start Shopping Now";
}

function updatePromoLivePreviewUI() {
  const toggle = document.getElementById("promoBannerEnabledToggle");
  const badgeInput = document.getElementById("promoBannerBadgeInput");
  const couponInput = document.getElementById("promoBannerCouponInput");
  const titleInput = document.getElementById("promoBannerTitleInput");
  const descInput = document.getElementById("promoBannerDescInput");
  const btnTextInput = document.getElementById("promoBannerBtnTextInput");

  const previewBox = document.getElementById("adminPromoLivePreview");
  const previewBadge = document.getElementById("adminPromoPreviewBadge");
  const previewTitle = document.getElementById("adminPromoPreviewTitle");
  const previewDesc = document.getElementById("adminPromoPreviewDesc");
  const previewBtn = document.getElementById("adminPromoPreviewBtn");

  const isEnabled = toggle ? toggle.checked : false;
  const badgeText = badgeInput?.value.trim() || "";
  const couponCode = couponInput?.value.trim().toUpperCase() || "AURA10";
  const titleText = titleInput?.value.trim() || "Unlock 10% Off Your Entire Cart";
  const descText = descInput?.value.trim() || `Use coupon code ${couponCode} during checkout for instant savings.`;
  const btnText = btnTextInput?.value.trim() || "Start Shopping Now";

  if (previewBadge) {
    if (badgeText) {
      previewBadge.textContent = badgeText;
      previewBadge.style.display = "inline-block";
    } else {
      previewBadge.style.display = "none";
    }
  }

  if (previewTitle) previewTitle.textContent = titleText;
  if (previewDesc) {
    previewDesc.innerHTML = `Use coupon code <strong style="background: rgba(15, 23, 42, 0.9); padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid rgba(249, 115, 22, 0.5); color: var(--color-orange); font-size:0.95rem;">${couponCode}</strong> during checkout for instant savings.`;
  }
  if (previewBtn) previewBtn.textContent = btnText;

  if (previewBox) {
    if (!isEnabled) {
      previewBox.style.opacity = "0.45";
      previewBox.style.filter = "grayscale(0.7)";
    } else {
      previewBox.style.opacity = "1";
      previewBox.style.filter = "none";
    }
  }
}

// ==================== HERO BENTO FLASH DEAL ADMIN SYSTEM ====================
let currentFlashDealData = {
  enabled: false,
  badge: "🔥 Deal of the Day",
  discountTag: "-25% OFF",
  title: "Aura Horizon Watch",
  description: "Sapphire crystal glass & ECG monitor.",
  price: "Rs. 12,500",
  originalPrice: "Rs. 16,500",
  image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80",
  hours: 4,
  minutes: 28,
  seconds: 45,
  buttonText: "Claim Deal"
};

async function loadFlashDealAdminSettings() {
  try {
    const data = await DBService.getFlashDeal();
    if (data) {
      currentFlashDealData = { ...currentFlashDealData, ...data };
    }
    populateFlashDealForm();
    updateFlashDealLivePreviewUI();
  } catch (err) {
    console.warn("Failed to load flash deal admin settings:", err);
  }
}

function populateFlashDealForm() {
  const toggle = document.getElementById("flashDealEnabledToggle");
  const badgeInput = document.getElementById("flashDealBadgeInput");
  const discountInput = document.getElementById("flashDealDiscountInput");
  const titleInput = document.getElementById("flashDealTitleInput");
  const descInput = document.getElementById("flashDealDescInput");
  const priceInput = document.getElementById("flashDealPriceInput");
  const origPriceInput = document.getElementById("flashDealOriginalPriceInput");
  const imageInput = document.getElementById("flashDealImageInput");
  const hoursInput = document.getElementById("flashDealHoursInput");
  const minsInput = document.getElementById("flashDealMinsInput");
  const secsInput = document.getElementById("flashDealSecsInput");
  const btnTextInput = document.getElementById("flashDealBtnTextInput");

  if (toggle) toggle.checked = Boolean(currentFlashDealData.enabled);
  if (badgeInput) badgeInput.value = currentFlashDealData.badge || "🔥 Deal of the Day";
  if (discountInput) discountInput.value = currentFlashDealData.discountTag || "-25% OFF";
  if (titleInput) titleInput.value = currentFlashDealData.title || "";
  if (descInput) descInput.value = currentFlashDealData.description || "";
  if (priceInput) priceInput.value = currentFlashDealData.price || "Rs. 12,500";
  if (origPriceInput) origPriceInput.value = currentFlashDealData.originalPrice || "";
  if (imageInput) imageInput.value = currentFlashDealData.image || "";
  if (hoursInput) hoursInput.value = currentFlashDealData.hours !== undefined ? currentFlashDealData.hours : 4;
  if (minsInput) minsInput.value = currentFlashDealData.minutes !== undefined ? currentFlashDealData.minutes : 28;
  if (secsInput) secsInput.value = currentFlashDealData.seconds !== undefined ? currentFlashDealData.seconds : 45;
  if (btnTextInput) btnTextInput.value = currentFlashDealData.buttonText || "Claim Deal";
}

function updateFlashDealLivePreviewUI() {
  const toggle = document.getElementById("flashDealEnabledToggle");
  const badgeInput = document.getElementById("flashDealBadgeInput");
  const discountInput = document.getElementById("flashDealDiscountInput");
  const titleInput = document.getElementById("flashDealTitleInput");
  const descInput = document.getElementById("flashDealDescInput");
  const priceInput = document.getElementById("flashDealPriceInput");
  const origPriceInput = document.getElementById("flashDealOriginalPriceInput");
  const imageInput = document.getElementById("flashDealImageInput");
  const hoursInput = document.getElementById("flashDealHoursInput");
  const minsInput = document.getElementById("flashDealMinsInput");
  const secsInput = document.getElementById("flashDealSecsInput");
  const btnTextInput = document.getElementById("flashDealBtnTextInput");

  const previewBox = document.getElementById("adminFlashDealLivePreview");
  const previewBadge = document.getElementById("adminFlashDealPreviewBadge");
  const previewDiscount = document.getElementById("adminFlashDealPreviewDiscount");
  const previewTitle = document.getElementById("adminFlashDealPreviewTitle");
  const previewDesc = document.getElementById("adminFlashDealPreviewDesc");
  const previewImgWrapper = document.getElementById("adminFlashDealPreviewImgWrapper");
  const previewImg = document.getElementById("adminFlashDealPreviewImg");
  const previewHours = document.getElementById("adminFlashDealPreviewHours");
  const previewMins = document.getElementById("adminFlashDealPreviewMins");
  const previewSecs = document.getElementById("adminFlashDealPreviewSecs");
  const previewPrice = document.getElementById("adminFlashDealPreviewPrice");
  const previewOrigPrice = document.getElementById("adminFlashDealPreviewOrigPrice");
  const previewBtn = document.getElementById("adminFlashDealPreviewBtn");
  const statusIndicator = document.getElementById("flashDealStatusIndicator");

  const isEnabled = toggle ? toggle.checked : false;

  if (statusIndicator) {
    if (isEnabled) {
      statusIndicator.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#10b981;"></span><span>STATUS: LIVE ON STORE</span>';
      statusIndicator.style.background = "rgba(16, 185, 129, 0.15)";
      statusIndicator.style.color = "#10b981";
      statusIndicator.style.borderColor = "rgba(16, 185, 129, 0.3)";
    } else {
      statusIndicator.innerHTML = '<span style="width:8px; height:8px; border-radius:50%; background:#ef4444;"></span><span>STATUS: HIDDEN / OFF</span>';
      statusIndicator.style.background = "rgba(239, 68, 68, 0.15)";
      statusIndicator.style.color = "#ef4444";
      statusIndicator.style.borderColor = "rgba(239, 68, 68, 0.3)";
    }
  }

  if (previewBadge) previewBadge.textContent = badgeInput?.value.trim() || "🔥 Deal of the Day";
  if (previewDiscount) previewDiscount.textContent = discountInput?.value.trim() || "-25% OFF";
  if (previewTitle) previewTitle.textContent = titleInput?.value.trim() || "Aura Horizon Watch";
  if (previewDesc) previewDesc.textContent = descInput?.value.trim() || "Sapphire crystal glass & ECG monitor.";

  const imgUrl = imageInput?.value.trim() || "";
  if (previewImg && previewImgWrapper) {
    if (imgUrl) {
      previewImg.src = imgUrl;
      previewImgWrapper.style.display = "flex";
    } else {
      previewImgWrapper.style.display = "none";
    }
  }

  if (previewHours) previewHours.textContent = String(hoursInput?.value || 4).padStart(2, "0");
  if (previewMins) previewMins.textContent = String(minsInput?.value || 28).padStart(2, "0");
  if (previewSecs) previewSecs.textContent = String(secsInput?.value || 45).padStart(2, "0");

  if (previewPrice) previewPrice.textContent = priceInput?.value.trim() || "Rs. 12,500";
  if (previewOrigPrice) {
    const orig = origPriceInput?.value.trim();
    if (orig) {
      previewOrigPrice.textContent = orig;
      previewOrigPrice.style.display = "inline";
    } else {
      previewOrigPrice.style.display = "none";
    }
  }
  if (previewBtn) previewBtn.textContent = btnTextInput?.value.trim() || "Claim Deal";

  if (previewBox) {
    if (!isEnabled) {
      previewBox.style.opacity = "0.45";
      previewBox.style.filter = "grayscale(0.7)";
    } else {
      previewBox.style.opacity = "1";
      previewBox.style.filter = "none";
    }
  }
}

// ==================== EVENT LISTENERS SETUP ====================
function setupEventListeners() {
  // Topbar and Section Header Add Product Buttons
  document.getElementById("adminOpenAddProductBtn")?.addEventListener("click", () => openProductModal(false));
  document.getElementById("adminAddProductBtn2")?.addEventListener("click", () => openProductModal(false));
  document.getElementById("closeProductModalBtn")?.addEventListener("click", closeProductModal);
  document.getElementById("cancelProductBtn")?.addEventListener("click", closeProductModal);

  // Multi-File Picker with Direct Cloudinary Upload
  document.getElementById("formMultiFileInput")?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    showToast(`Uploading ${files.length} image(s) to Cloudinary...`, "info");
    for (const file of files) {
      try {
        const cloudUrl = await CloudinaryService.uploadImage(file);
        if (cloudUrl && !currentProductImages.includes(cloudUrl)) {
          currentProductImages.push(cloudUrl);
          renderFormThumbnails();
        }
      } catch (err) {
        showToast("Cloudinary upload failed: " + err.message, "error");
      }
    }
    showToast("Images uploaded to Cloudinary successfully!", "success");
    e.target.value = "";
  });

  // Direct URL Add
  document.getElementById("formAddUrlImageBtn")?.addEventListener("click", () => {
    const urlInput = document.getElementById("formDirectUrlInput");
    const val = urlInput?.value.trim();
    if (val) {
      currentProductImages.push(val);
      urlInput.value = "";
      renderFormThumbnails();
      showToast("Image URL added to gallery", "success");
    }
  });

  // Live Camera Controls
  const cameraModal = document.getElementById("adminCameraModalOverlay");
  const cameraVideo = document.getElementById("adminCameraVideo");
  const cameraCanvas = document.getElementById("adminCameraCanvas");
  const cameraNotice = document.getElementById("cameraLoadingNotice");

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }
  }

  document.getElementById("formOpenLiveCameraBtn")?.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Camera access is not supported by your browser environment.", "error");
      return;
    }

    if (cameraModal) cameraModal.classList.add("active");
    if (cameraNotice) cameraNotice.style.display = "flex";

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" }
      });
      if (cameraVideo) {
        cameraVideo.srcObject = cameraStream;
        cameraVideo.onloadedmetadata = () => {
          if (cameraNotice) cameraNotice.style.display = "none";
          cameraVideo.play();
        };
      }
    } catch (err) {
      showToast("Failed to access camera: " + err.message, "error");
      if (cameraModal) cameraModal.classList.remove("active");
    }
  });

  document.getElementById("cameraSnapPhotoBtn")?.addEventListener("click", async () => {
    if (!cameraVideo || !cameraCanvas) return;

    cameraCanvas.width = cameraVideo.videoWidth || 640;
    cameraCanvas.height = cameraVideo.videoHeight || 480;
    const ctx = cameraCanvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);

    const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.85);
    stopCameraStream();
    if (cameraModal) cameraModal.classList.remove("active");

    showToast("Uploading captured photo to Cloudinary...", "info");
    try {
      const cloudUrl = await CloudinaryService.uploadImage(dataUrl);
      currentProductImages.push(cloudUrl);
      renderFormThumbnails();
      showToast("📸 Photo uploaded to Cloudinary & added to gallery!", "success");
    } catch (err) {
      showToast("Cloudinary upload failed: " + err.message, "error");
    }
  });

  document.getElementById("closeCameraModalBtn")?.addEventListener("click", () => {
    stopCameraStream();
    if (cameraModal) cameraModal.classList.remove("active");
  });

  document.getElementById("cameraCancelBtn")?.addEventListener("click", () => {
    stopCameraStream();
    if (cameraModal) cameraModal.classList.remove("active");
  });

  document.getElementById("productForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (currentProductImages.length === 0) {
      showToast("Please attach at least one product image via file pick, camera, or URL.", "warning");
      return;
    }

    const saveBtn = document.getElementById("saveProductBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Processing images..."; }

    try {
      const uploadedImages = [];
      for (const img of currentProductImages) {
        if (img.startsWith("data:") || img.startsWith("blob:")) {
          const uploaded = await CloudinaryService.uploadImage(img);
          uploadedImages.push(uploaded);
        } else {
          uploadedImages.push(img);
        }
      }
      currentProductImages = uploadedImages;

      if (saveBtn) saveBtn.textContent = "Saving to Firestore...";

      const id = document.getElementById("formProductId")?.value;
      const productPayload = {
        title: document.getElementById("formTitle").value,
        category: document.getElementById("formCategory").value,
        badge: document.getElementById("formBadge").value,
        price: document.getElementById("formPrice").value,
        originalPrice: document.getElementById("formOriginalPrice").value,
        stock: document.getElementById("formStock").value,
        image: currentProductImages[0],
        images: currentProductImages,
        description: document.getElementById("formDescription").value,
        featured: document.getElementById("formFeatured").checked
      };

      if (id) {
        await DBService.updateProduct(id, productPayload);
        showToast("Product updated successfully in Firestore!", "success");
      } else {
        await DBService.addProduct(productPayload);
        showToast("New product created and saved to Firestore!", "success");
      }
      closeProductModal();
      await refreshAllData();
    } catch (err) {
      showToast("Error saving product: " + err.message, "error");
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save to Firestore"; }
    }
  });

  document.getElementById("closeAdminOrderDetailsBtn")?.addEventListener("click", () => {
    document.getElementById("adminOrderDetailsModalOverlay")?.classList.remove("active");
  });

  document.getElementById("productFilterInput")?.addEventListener("input", (e) => {
    currentProductFilter = e.target.value;
    renderProductsTable();
  });

  document.getElementById("adminGlobalSearch")?.addEventListener("input", (e) => {
    currentProductFilter = e.target.value;
    renderProductsTable();
  });

  document.getElementById("orderStatusFilterSelect")?.addEventListener("change", (e) => {
    currentOrderStatusFilter = e.target.value;
    renderOrdersTable();
  });

  document.getElementById("closeAdminEmailModalBtn")?.addEventListener("click", () => {
    document.getElementById("adminEmailDispatchModalOverlay")?.classList.remove("active");
  });
  document.getElementById("emailModalDoneBtn")?.addEventListener("click", () => {
    document.getElementById("adminEmailDispatchModalOverlay")?.classList.remove("active");
  });

  // Announcement Bar Live Controls & Form Submit
  const announcementEnabledToggle = document.getElementById("announcementEnabledToggle");
  const announcementBadgeInput = document.getElementById("announcementBadgeInput");
  const announcementTextInput = document.getElementById("announcementTextInput");
  const announcementGradientSelect = document.getElementById("announcementGradientSelect");
  const adminAnnouncementForm = document.getElementById("adminAnnouncementForm");
  const announcementTurnOffBtn = document.getElementById("announcementTurnOffBtn");

  announcementEnabledToggle?.addEventListener("change", () => updateLivePreviewUI());
  announcementBadgeInput?.addEventListener("input", () => updateLivePreviewUI());
  announcementTextInput?.addEventListener("input", () => updateLivePreviewUI());
  announcementGradientSelect?.addEventListener("change", () => updateLivePreviewUI());

  adminAnnouncementForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("announcementSaveBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Publishing to Store..."; }

    try {
      const payload = {
        enabled: Boolean(announcementEnabledToggle?.checked),
        badge: announcementBadgeInput?.value.trim() || "",
        text: announcementTextInput?.value.trim() || "",
        gradient: announcementGradientSelect?.value || "linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f97316 100%)"
      };

      await DBService.updateAnnouncement(payload);
      currentAnnouncementData = { ...payload };
      updateLivePreviewUI();

      if (payload.enabled) {
        showToast("🎉 Top announcement published and live on storefront!", "success");
      } else {
        showToast("Announcement saved (currently hidden/disabled).", "info");
      }
    } catch (err) {
      showToast("Failed to update announcement: " + err.message, "error");
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Save & Publish Announcement"; }
    }
  });

  announcementTurnOffBtn?.addEventListener("click", async () => {
    if (announcementEnabledToggle) announcementEnabledToggle.checked = false;
    updateLivePreviewUI();

    try {
      const payload = {
        enabled: false,
        badge: announcementBadgeInput?.value.trim() || "",
        text: announcementTextInput?.value.trim() || "",
        gradient: announcementGradientSelect?.value || ""
      };
      await DBService.updateAnnouncement(payload);
      currentAnnouncementData = { ...payload };
      showToast("🚫 Announcement ticker has been disabled and hidden from store.", "info");
    } catch (err) {
      showToast("Error updating announcement: " + err.message, "error");
    }
  });

  // Promotional Discount Banner Live Controls & Form Submit
  const promoEnabledToggle = document.getElementById("promoBannerEnabledToggle");
  const promoBadgeInput = document.getElementById("promoBannerBadgeInput");
  const promoCouponInput = document.getElementById("promoBannerCouponInput");
  const promoTitleInput = document.getElementById("promoBannerTitleInput");
  const promoDescInput = document.getElementById("promoBannerDescInput");
  const promoBtnTextInput = document.getElementById("promoBannerBtnTextInput");
  const adminPromoBannerForm = document.getElementById("adminPromoBannerForm");
  const promoBannerTurnOffBtn = document.getElementById("promoBannerTurnOffBtn");

  promoEnabledToggle?.addEventListener("change", () => updatePromoLivePreviewUI());
  promoBadgeInput?.addEventListener("input", () => updatePromoLivePreviewUI());
  promoCouponInput?.addEventListener("input", () => updatePromoLivePreviewUI());
  promoTitleInput?.addEventListener("input", () => updatePromoLivePreviewUI());
  promoDescInput?.addEventListener("input", () => updatePromoLivePreviewUI());
  promoBtnTextInput?.addEventListener("input", () => updatePromoLivePreviewUI());

  adminPromoBannerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("promoBannerSaveBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Publishing Promo Banner..."; }

    try {
      const payload = {
        enabled: Boolean(promoEnabledToggle?.checked),
        badge: promoBadgeInput?.value.trim() || "",
        couponCode: (promoCouponInput?.value || "AURA10").trim().toUpperCase(),
        title: promoTitleInput?.value.trim() || "",
        description: promoDescInput?.value.trim() || "",
        buttonText: promoBtnTextInput?.value.trim() || "Start Shopping Now"
      };

      await DBService.savePromoBanner(payload);
      currentPromoBannerData = { ...payload };
      updatePromoLivePreviewUI();

      if (payload.enabled) {
        showToast("🎉 Promotional Discount Banner published and live on storefront!", "success");
      } else {
        showToast("Promotional Banner saved (currently hidden/disabled).", "info");
      }
    } catch (err) {
      showToast("Failed to save promo banner: " + err.message, "error");
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Save & Publish Promo Banner"; }
    }
  });

  promoBannerTurnOffBtn?.addEventListener("click", async () => {
    if (promoEnabledToggle) promoEnabledToggle.checked = false;
    updatePromoLivePreviewUI();

    try {
      const payload = {
        enabled: false,
        badge: promoBadgeInput?.value.trim() || "",
        couponCode: (promoCouponInput?.value || "AURA10").trim().toUpperCase(),
        title: promoTitleInput?.value.trim() || "",
        description: promoDescInput?.value.trim() || "",
        buttonText: promoBtnTextInput?.value.trim() || "Start Shopping Now"
      };
      await DBService.savePromoBanner(payload);
      currentPromoBannerData = { ...payload };
      showToast("🚫 Promotional discount banner has been disabled and hidden from store.", "info");
    } catch (err) {
      showToast("Error updating promo banner: " + err.message, "error");
    }
  });

  // Hero Bento Flash Deal Live Controls & Form Submit
  const flashEnabledToggle = document.getElementById("flashDealEnabledToggle");
  const flashBadgeInput = document.getElementById("flashDealBadgeInput");
  const flashDiscountInput = document.getElementById("flashDealDiscountInput");
  const flashTitleInput = document.getElementById("flashDealTitleInput");
  const flashDescInput = document.getElementById("flashDealDescInput");
  const flashPriceInput = document.getElementById("flashDealPriceInput");
  const flashOrigPriceInput = document.getElementById("flashDealOriginalPriceInput");
  const flashImageInput = document.getElementById("flashDealImageInput");
  const flashHoursInput = document.getElementById("flashDealHoursInput");
  const flashMinsInput = document.getElementById("flashDealMinsInput");
  const flashSecsInput = document.getElementById("flashDealSecsInput");
  const flashBtnTextInput = document.getElementById("flashDealBtnTextInput");
  const adminFlashDealForm = document.getElementById("adminFlashDealForm");
  const flashDealTurnOffBtn = document.getElementById("flashDealTurnOffBtn");

  flashEnabledToggle?.addEventListener("change", () => updateFlashDealLivePreviewUI());
  flashBadgeInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashDiscountInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashTitleInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashDescInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashPriceInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashOrigPriceInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashImageInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashHoursInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashMinsInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashSecsInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());
  flashBtnTextInput?.addEventListener("input", () => updateFlashDealLivePreviewUI());

  adminFlashDealForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById("flashDealSaveBtn");
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Publishing Flash Deal..."; }

    try {
      const payload = {
        enabled: Boolean(flashEnabledToggle?.checked),
        badge: flashBadgeInput?.value.trim() || "🔥 Deal of the Day",
        discountTag: flashDiscountInput?.value.trim() || "-25% OFF",
        title: flashTitleInput?.value.trim() || "Aura Horizon Watch",
        description: flashDescInput?.value.trim() || "",
        price: flashPriceInput?.value.trim() || "Rs. 12,500",
        originalPrice: flashOrigPriceInput?.value.trim() || "",
        image: flashImageInput?.value.trim() || "",
        hours: parseInt(flashHoursInput?.value) >= 0 ? parseInt(flashHoursInput?.value) : 4,
        minutes: parseInt(flashMinsInput?.value) >= 0 ? parseInt(flashMinsInput?.value) : 28,
        seconds: parseInt(flashSecsInput?.value) >= 0 ? parseInt(flashSecsInput?.value) : 45,
        buttonText: flashBtnTextInput?.value.trim() || "Claim Deal"
      };

      await DBService.saveFlashDeal(payload);
      currentFlashDealData = { ...payload };
      updateFlashDealLivePreviewUI();

      if (payload.enabled) {
        showToast("⚡ Hero Flash Deal published and live on storefront!", "success");
      } else {
        showToast("Hero Flash Deal saved (currently hidden/disabled).", "info");
      }
    } catch (err) {
      showToast("Failed to save flash deal: " + err.message, "error");
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "💾 Save & Publish Flash Deal"; }
    }
  });

  flashDealTurnOffBtn?.addEventListener("click", async () => {
    if (flashEnabledToggle) flashEnabledToggle.checked = false;
    updateFlashDealLivePreviewUI();

    try {
      const payload = {
        enabled: false,
        badge: flashBadgeInput?.value.trim() || "🔥 Deal of the Day",
        discountTag: flashDiscountInput?.value.trim() || "-25% OFF",
        title: flashTitleInput?.value.trim() || "Aura Horizon Watch",
        description: flashDescInput?.value.trim() || "",
        price: flashPriceInput?.value.trim() || "Rs. 12,500",
        originalPrice: flashOrigPriceInput?.value.trim() || "",
        image: flashImageInput?.value.trim() || "",
        hours: parseInt(flashHoursInput?.value) || 4,
        minutes: parseInt(flashMinsInput?.value) || 28,
        seconds: parseInt(flashSecsInput?.value) || 45,
        buttonText: flashBtnTextInput?.value.trim() || "Claim Deal"
      };
      await DBService.saveFlashDeal(payload);
      currentFlashDealData = { ...payload };
      showToast("🚫 Hero flash deal card has been disabled and hidden from store.", "info");
    } catch (err) {
      showToast("Error updating flash deal: " + err.message, "error");
    }
  });

  // Built-in Admin Gate Login Form (Modal)
  document.getElementById("gateLoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("gateAdminEmail")?.value.trim();
    const password = document.getElementById("gateAdminPassword")?.value;

    try {
      const user = await AuthService.login(email, password);
      if (!user.isAdmin) {
        showToast("Access Denied: This account is not an administrator.", "error");
        return;
      }
      document.getElementById("adminAuthGateOverlay")?.classList.remove("active");
      showToast(`Welcome back, ${user.displayName}!`, "success");
      await refreshAllData();
    } catch (err) {
      showToast(err.message || "Failed to authenticate administrator.", "error");
    }
  });

  // Manual Sync & Refresh Button
  const refreshBtn = document.getElementById("adminRefreshDataBtn");
  const refreshIcon = document.getElementById("adminRefreshIcon");
  const refreshText = document.getElementById("adminRefreshBtnText");

  refreshBtn?.addEventListener("click", async () => {
    if (refreshIcon) refreshIcon.style.animation = "spin 0.75s linear infinite";
    if (refreshBtn) refreshBtn.disabled = true;
    if (refreshText) refreshText.textContent = "Syncing...";

    try {
      await refreshAllData({ showBanner: true });
      showToast("⚡ Dashboard data successfully synchronized!", "success", 2500);
    } catch (e) {
      showToast("Synced with local database cache", "info", 2000);
    } finally {
      setTimeout(() => {
        if (refreshIcon) refreshIcon.style.animation = "none";
        if (refreshBtn) refreshBtn.disabled = false;
        if (refreshText) refreshText.textContent = "Sync & Refresh";
      }, 450);
    }
  });

  // Auto-Refresh on custom events and multi-tab updates (Silent in background)
  window.addEventListener("aura_products_changed", () => refreshAllData({ silent: true }));
  window.addEventListener("aura_orders_changed", () => refreshAllData({ silent: true }));
  window.addEventListener("aura_announcement_changed", () => loadAnnouncementAdminSettings());
  window.addEventListener("aura_flash_deal_changed", () => loadFlashDealAdminSettings());

  // Real-time synchronization across browser tabs (Silent)
  window.addEventListener("storage", (e) => {
    if (e.key === "aura_orders_cache" || e.key === "aura_products_cache" || e.key === "aura_announcement_cache" || e.key === "aura_flash_deal_cache") {
      refreshAllData({ silent: true });
    }
  });
}

// ==================== ADMIN SECURITY GUARD ====================
function setupAdminAuthGuard() {
  const adminSignOutBtn = document.getElementById("adminSignOutBtn");
  const gateModal = document.getElementById("adminAuthGateOverlay");
  const gateDeniedContainer = document.getElementById("gateAccessDeniedContainer");
  const gateLoginContainer = document.getElementById("gateLoginFormContainer");

  AuthService.onAuthStateChange(async (user) => {
    if (!user) {
      // Show Gate Login Modal
      if (gateModal) {
        gateModal.classList.add("active");
        if (gateLoginContainer) gateLoginContainer.style.display = "block";
        if (gateDeniedContainer) gateDeniedContainer.style.display = "none";
      }
      return;
    }

    if (!user.isAdmin) {
      // Show Access Denied State in Gate
      if (gateModal) {
        gateModal.classList.add("active");
        if (gateLoginContainer) gateLoginContainer.style.display = "none";
        if (gateDeniedContainer) gateDeniedContainer.style.display = "block";
      }
      return;
    }

    // Authenticated Admin -> Hide Gate & Load Firestore Profile
    if (gateModal) gateModal.classList.remove("active");

    const nameEl = document.getElementById("adminSidebarName");
    const emailEl = document.getElementById("adminSidebarEmail");
    const avatarEl = document.getElementById("adminSidebarAvatar");

    try {
      // Fetch live admin record from Cloud Firestore (admin/inventory)
      const firestoreAdmin = await DBService.getAdminProfile(user.uid);
      if (nameEl) nameEl.textContent = firestoreAdmin.name || firestoreAdmin.displayName || user.displayName || "";
      if (emailEl) emailEl.textContent = firestoreAdmin.email || user.email;
      if (avatarEl) avatarEl.src = firestoreAdmin.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`;
    } catch (e) {
      if (nameEl) nameEl.textContent = user.displayName || "";
      if (emailEl) emailEl.textContent = user.email;
      if (avatarEl) avatarEl.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`;
    }

    await refreshAllData();
  });

  // Handle Switch Account in Gate
  document.getElementById("gateSwitchAccountBtn")?.addEventListener("click", async () => {
    await AuthService.logout();
    if (gateLoginContainer) gateLoginContainer.style.display = "block";
    if (gateDeniedContainer) gateDeniedContainer.style.display = "none";
  });

  adminSignOutBtn?.addEventListener("click", async () => {
    const confirmOut = await showConfirmDialog({
      title: "Sign Out",
      message: "Are you sure you want to sign out from the Admin Management Portal?",
      icon: "🔒",
      confirmText: "Sign Out",
      cancelText: "Stay Logged In",
      type: "warning"
    });

    if (confirmOut) {
      await AuthService.logout();
      window.location.replace("./login.html");
    }
  });
}
