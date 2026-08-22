// user/js/app.js - AURA 2.0 Customer Storefront Application Logic
import { DBService } from "../../shared/services/db-service.js";
import { AuthService } from "../../shared/services/auth-service.js";
import { NetworkService } from "../../shared/services/network-service.js";

// ==================== GLOBAL STATE ====================
let allProducts = [];
let currentCategory = "ALL";
let searchQuery = "";
let currentSort = "featured";
let activeProductModal = null;
let isAuthGateMandatory = true;

// Mock active orders simulation for social proof
const liveActivityData = [
  { customer: "Hamza Khan (Lahore)", product: "Aura Pro Titanium ANC Headphones" },
  { customer: "Ali Raza (Karachi)", product: "Aura Horizon Sapphire Watch" },
  { customer: "Bilal Malik (Islamabad)", product: "Aura 360 Spatial Soundbar" },
  { customer: "Zainab Tariq (Faisalabad)", product: "Aura Minimalist Leather Sleeve" },
  { customer: "Osman Sheikh (Rawalpindi)", product: "Aura Carbon Fiber Earbuds" },
  { customer: "Fatima Noor (Multan)", product: "Aura MagSafe Power Stand" }
];
let currentLiveActivityIdx = 0;

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  AuthService.init();
  await DBService.init();

  initGSAPStorefrontAnimations();
  setupEventListeners();
  initFlashCountdownTimer();
  initLiveActivityTicker();
  await loadAnnouncementTicker();
  await loadPromoBanner();
  setupFAQAccordion();

  // Initialize Cart
  CartStore.init();
  updateCartUI();

  // Check Auth State
  checkAuthState();

  // Load Cloud Products
  await loadProducts();
});

// ==================== GSAP ANIMATIONS SUITE ====================
function initGSAPStorefrontAnimations() {
  if (typeof gsap === "undefined") return;

  // Animate Floating Island Navbar
  gsap.from(".navbar-island", {
    y: -40,
    opacity: 0,
    duration: 0.8,
    ease: "power3.out"
  });

  // Animate Bento Grid Cards Stagger
  gsap.from(".bento-card", {
    y: 35,
    opacity: 0,
    duration: 0.75,
    stagger: 0.12,
    ease: "power2.out",
    delay: 0.15
  });

  // Animate Trust Cards
  gsap.from(".trust-item", {
    scrollTrigger: {
      trigger: ".trust-bar",
      start: "top 85%"
    },
    y: 25,
    opacity: 0,
    duration: 0.6,
    stagger: 0.1,
    ease: "power2.out"
  });
}

// ==================== THEME TOGGLE ====================
function initTheme() {
  const savedTheme = localStorage.getItem("aura_theme") || "dark";
  if (savedTheme === "light") {
    document.documentElement.classList.add("light-theme");
    document.body.classList.add("light-theme");
  } else {
    document.documentElement.classList.remove("light-theme");
    document.body.classList.remove("light-theme");
  }
}

function toggleTheme() {
  const isLight = document.documentElement.classList.toggle("light-theme");
  document.body.classList.toggle("light-theme", isLight);
  localStorage.setItem("aura_theme", isLight ? "light" : "dark");
  showToast(`Switched to ${isLight ? "Light" : "Dark"} mode`, "info", 2000);
}

// ==================== LIVE COUNTDOWN & ACTIVITY ====================
function initFlashCountdownTimer() {
  let totalSeconds = 4 * 3600 + 28 * 60 + 45; // 04h 28m 45s

  setInterval(() => {
    if (totalSeconds <= 0) {
      totalSeconds = 24 * 3600; // Reset to 24h
    }
    totalSeconds--;

    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    const elH = document.getElementById("dealHours");
    const elM = document.getElementById("dealMinutes");
    const elS = document.getElementById("dealSeconds");

    if (elH) elH.textContent = String(hours).padStart(2, "0");
    if (elM) elM.textContent = String(mins).padStart(2, "0");
    if (elS) elS.textContent = String(secs).padStart(2, "0");
  }, 1000);
}

function initLiveActivityTicker() {
  setInterval(() => {
    currentLiveActivityIdx = (currentLiveActivityIdx + 1) % liveActivityData.length;
    const item = liveActivityData[currentLiveActivityIdx];
    const customerEl = document.getElementById("liveOrderCustomer");
    const productEl = document.getElementById("liveOrderProduct");

    if (customerEl && productEl) {
      if (typeof gsap !== "undefined") {
        gsap.to("#liveOrderTicker", {
          opacity: 0,
          y: -5,
          duration: 0.25,
          onComplete: () => {
            customerEl.textContent = item.customer;
            productEl.textContent = `Just ordered ${item.product}`;
            gsap.to("#liveOrderTicker", { opacity: 1, y: 0, duration: 0.25 });
          }
        });
      } else {
        customerEl.textContent = item.customer;
        productEl.textContent = `Just ordered ${item.product}`;
      }
    }
  }, 5500);
}

// ==================== LIVE ANNOUNCEMENT TICKER (ADMIN CONTROLLED) ====================
async function loadAnnouncementTicker() {
  const tickerEl = document.getElementById("topLiveAnnouncementTicker");
  const badgeEl = document.getElementById("topAnnouncementBadge");
  const textEl = document.getElementById("topAnnouncementText");

  if (!tickerEl) return;

  try {
    const data = await DBService.getAnnouncement();
    if (data && data.enabled && (data.text || data.badge)) {
      if (badgeEl) {
        if (data.badge && data.badge.trim()) {
          badgeEl.textContent = data.badge.trim();
          badgeEl.style.display = "inline-block";
        } else {
          badgeEl.style.display = "none";
        }
      }

      if (textEl) {
        textEl.innerHTML = data.text || "";
      }

      if (data.gradient) {
        tickerEl.style.background = data.gradient;
      }

      tickerEl.style.display = "block";
    } else {
      tickerEl.style.display = "none";
    }
  } catch (err) {
    console.warn("Failed to load live announcement ticker:", err);
    tickerEl.style.display = "none";
  }
}

// ==================== PROMOTIONAL DISCOUNT BANNER (ADMIN CONTROLLED) ====================
async function loadPromoBanner() {
  const promoSection = document.getElementById("promoDiscountSection");
  const badgeEl = document.getElementById("promoDiscountBadge");
  const titleEl = document.getElementById("promoDiscountTitle");
  const descEl = document.getElementById("promoDiscountDesc");
  const codeEl = document.getElementById("promoDiscountCode");
  const btnEl = document.getElementById("promoDiscountBtn");
  const copyBtn = document.getElementById("promoCopyCouponBtn");
  const copyText = document.getElementById("promoCopyCodeText");

  if (!promoSection) return;

  try {
    const data = await DBService.getPromoBanner();
    if (data && data.enabled) {
      if (badgeEl) {
        badgeEl.textContent = data.badge || "🔥 Exclusive Limited Time Offer";
        badgeEl.style.display = data.badge ? "inline-block" : "none";
      }

      if (titleEl) titleEl.textContent = data.title || "Unlock 10% Off Your Entire Cart";
      
      const code = data.couponCode || "AURA10";
      if (codeEl) codeEl.textContent = code;
      if (copyText) copyText.textContent = code;

      if (descEl) {
        descEl.innerHTML = `Use coupon code <strong id="promoDiscountCode" style="background: rgba(15, 23, 42, 0.9); padding: 0.3rem 0.8rem; border-radius: 8px; border: 1px solid rgba(249, 115, 22, 0.5); color: var(--color-orange); font-size:1.1rem;">${code}</strong> during checkout for instant savings.`;
      }

      if (btnEl && data.buttonText) {
        btnEl.textContent = data.buttonText;
      }

      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(code);
            showToast(`🎉 Coupon code "${code}" copied! Paste at checkout.`, "success");
            copyBtn.textContent = `✓ Copied: ${code}`;
            setTimeout(() => {
              copyBtn.innerHTML = `📋 Copy Code: <span id="promoCopyCodeText">${code}</span>`;
            }, 2500);
          } catch (err) {
            showToast(`Coupon: ${code}`, "info");
          }
        };
      }

      promoSection.style.display = "block";
    } else {
      promoSection.style.display = "none";
    }
  } catch (err) {
    console.warn("Failed to load promo banner:", err);
    promoSection.style.display = "none";
  }
}

// Listen for admin changes in real time across tabs and events
window.addEventListener("aura_announcement_changed", () => {
  loadAnnouncementTicker();
});
window.addEventListener("aura_promo_banner_changed", () => {
  loadPromoBanner();
});
window.addEventListener("storage", (e) => {
  if (e.key === "aura_announcement_cache") {
    loadAnnouncementTicker();
  }
  if (e.key === "aura_promo_banner_cache") {
    loadPromoBanner();
  }
});

// ==================== PRODUCT CATALOG & RENDERING ====================
async function loadProducts() {
  try {
    allProducts = await DBService.getProducts();
    renderFilteredProducts();
  } catch (error) {
    console.error("Error loading products:", error);
    showToast("Failed to load products from store.", "error");
  }
}

function renderFilteredProducts() {
  const container = document.getElementById("mainProductsGrid");
  const countEl = document.getElementById("catalogResultsCount");
  if (!container) return;

  let filtered = [...allProducts];

  // Category filter
  if (currentCategory !== "ALL") {
    filtered = filtered.filter(p => p.category.toLowerCase() === currentCategory.toLowerCase());
  }

  // Search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  }

  // Sorting
  if (currentSort === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (currentSort === "price-desc") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (currentSort === "rating-desc") {
    filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (currentSort === "title-asc") {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (countEl) {
    countEl.textContent = `Showing ${filtered.length} Product${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background:var(--bg-card); border-radius:var(--radius-lg); border:1px dashed var(--glass-border);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5" style="margin-bottom:1rem;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <h3 style="margin-bottom:0.5rem;">No matching products found</h3>
        <p style="color:var(--text-muted); margin-bottom:1.5rem;">Try adjusting your search criteria or category capsule.</p>
        <button class="btn btn-secondary btn-sm" id="resetCatalogFilterBtn">Clear Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById("resetCatalogFilterBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        window.appFilterCategory("ALL");
        searchQuery = "";
        const searchInput = document.getElementById("globalSearchInput");
        if (searchInput) searchInput.value = "";
      });
    }
    return;
  }

  container.innerHTML = filtered.map(p => createProductCardHTML(p)).join("");

  // GSAP Product Cards Stagger Pop-in
  if (typeof gsap !== "undefined") {
    gsap.fromTo("#mainProductsGrid .product-card",
      { y: 30, opacity: 0, scale: 0.96 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.05, duration: 0.45, ease: "power2.out" }
    );
  }
}

function createProductCardHTML(product) {
  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const badgeClass = product.badge ? `badge-${product.badge.toLowerCase().replace(/\s+/g, '')}` : 'badge-new';

  const catLower = (product.category || '').toLowerCase();
  const catPillClass = catLower.includes('audio') ? 'cat-pill-audio'
    : catLower.includes('wear') || catLower.includes('watch') ? 'cat-pill-wearables'
    : catLower.includes('electr') || catLower.includes('tech') ? 'cat-pill-electronics'
    : catLower.includes('access') || catLower.includes('bag') ? 'cat-pill-accessories'
    : catLower.includes('home') || catLower.includes('desk') ? 'cat-pill-home'
    : catLower.includes('fash') || catLower.includes('cloth') ? 'cat-pill-fashion'
    : 'cat-pill-default';

  const imgUrl = (product.images && product.images.length > 0) 
    ? product.images[0] 
    : (product.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80');

  return `
    <article class="product-card" data-id="${product.id}">
      <div class="product-image-container" onclick="window.appOpenProductDetails('${product.id}')">
        ${product.badge ? `<span class="product-badge ${badgeClass}">${product.badge}</span>` : ''}
        ${discountPercent > 0 ? `<span class="product-badge badge-sale" style="left:auto; right:0.85rem;">-${discountPercent}%</span>` : ''}
        <img src="${imgUrl}" alt="${product.title}" class="product-image" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'">
      </div>

      <div class="product-content">
        <div class="product-meta">
          <span class="cat-pill ${catPillClass}">${product.category || 'Product'}</span>
          <div class="product-rating">
            <span>★</span>
            <span>${product.reviewsCount > 0 ? product.rating : '4.9'}</span>
            <span style="color:var(--text-muted); font-size:0.75rem; font-weight:400;">(${product.reviewsCount || 12})</span>
          </div>
        </div>

        <h3 class="product-title" onclick="window.appOpenProductDetails('${product.id}')" title="${product.title}">
          ${product.title}
        </h3>

        <div class="product-stock-pill">
          <span>⚡</span>
          <span>In Stock • Ready for Same-Day Dispatch</span>
        </div>

        <div class="product-bottom">
          <div class="product-pricing">
            <span class="product-price">Rs. ${Number(product.price || 0).toLocaleString()}</span>
            ${product.originalPrice && product.originalPrice > product.price ? `
              <span class="product-original-price">Rs. ${Number(product.originalPrice).toLocaleString()}</span>
            ` : ''}
          </div>
          <button class="btn-add-cart" onclick="window.appAddToCart('${product.id}')" aria-label="Add ${product.title} to cart">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add
          </button>
        </div>
      </div>
    </article>
  `;
}

// Global category filter helper
window.appFilterCategory = function(cat) {
  currentCategory = cat;
  document.querySelectorAll(".category-capsule").forEach(capsule => {
    capsule.classList.toggle("active", capsule.dataset.category.toLowerCase() === cat.toLowerCase());
  });
  document.getElementById("productsSection")?.scrollIntoView({ behavior: "smooth" });
  renderFilteredProducts();
};

// Global Add to Cart
window.appAddToCart = function(productId, qty = 1) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const count = Number(qty) || 1;
  CartStore.addItem(product, count);
  updateCartUI();
  openCartDrawer();
  showToast(`Added ${count > 1 ? count + 'x ' : ''}"${product.title}" to cart!`, "success");
};

// ==================== PRODUCT DETAILS & REVIEWS MODAL ====================
let selectedReviewRating = 5;
let productModalSelectedQty = 1;

window.appSwitchModalGalleryImage = function(imgUrl, btnEl) {
  const mainImg = document.getElementById("productModalMainImg");
  if (mainImg) {
    mainImg.src = imgUrl;
    if (typeof gsap !== "undefined") {
      gsap.fromTo(mainImg, { opacity: 0.7, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.25 });
    }
  }
  document.querySelectorAll(".gallery-thumb-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
};

window.appUpdateModalQty = function(delta) {
  const input = document.getElementById("productModalQtyInput");
  if (!input) return;
  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + delta);
  if (activeProductModal && activeProductModal.stock) {
    val = Math.min(val, activeProductModal.stock);
  }
  input.value = val;
  productModalSelectedQty = val;
};

window.appAddModalProductToCart = function(productId) {
  const input = document.getElementById("productModalQtyInput");
  const qty = input ? parseInt(input.value) || 1 : 1;
  window.appAddToCart(productId, qty);
  document.getElementById("productDetailsModalOverlay")?.classList.remove("active");
};

window.appToggleWriteReviewForm = function() {
  const formWrap = document.getElementById("writeReviewFormWrapper");
  if (!formWrap) return;
  const isHidden = formWrap.style.display === "none";
  formWrap.style.display = isHidden ? "block" : "none";
  if (isHidden) {
    formWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const nameInput = document.getElementById("reviewUserNameInput");
    if (nameInput && !nameInput.value) nameInput.focus();
  }
};

window.appSetReviewStar = function(starNumber) {
  selectedReviewRating = starNumber;
  const stars = document.querySelectorAll("#modalStarRatingPicker .star-item");
  const label = document.getElementById("starRatingLabel");
  const ratingTexts = {
    1: "1.0 (Poor)",
    2: "2.0 (Fair)",
    3: "3.0 (Good)",
    4: "4.0 (Very Good)",
    5: "5.0 (Excellent)"
  };

  stars.forEach(star => {
    const r = parseInt(star.dataset.rating) || 1;
    if (r <= starNumber) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  });

  if (label) label.textContent = ratingTexts[starNumber] || `${starNumber}.0`;
};

window.appRenderReviewsHtml = function(reviews) {
  if (!reviews || reviews.length === 0) {
    return `
      <div style="text-align:center; padding:2.5rem 1rem; background:var(--bg-elevated); border:1px dashed var(--glass-border); border-radius:var(--radius-md); color:var(--text-secondary);">
        <div style="font-size:2rem; margin-bottom:0.5rem;">🌟</div>
        <strong style="color:var(--text-primary); font-size:1.05rem; display:block; margin-bottom:0.25rem;">Be the First to Review!</strong>
        <p style="font-size:0.85rem; max-width:360px; margin:0 auto 1rem auto;">Share your genuine experience with this product to help fellow shoppers.</p>
        <button type="button" class="btn btn-secondary btn-sm" onclick="window.appToggleWriteReviewForm()">Write First Review ✍️</button>
      </div>
    `;
  }

  return reviews.map(rev => {
    const starCount = Math.round(Number(rev.rating) || 5);
    const starsHtml = "★".repeat(starCount) + "☆".repeat(5 - starCount);
    const dateStr = rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "Recent";
    const avatar = rev.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rev.userName || 'buyer')}`;

    return `
      <div class="review-item-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="${avatar}" alt="${rev.userName}" style="width:38px; height:38px; border-radius:50%; background:var(--bg-card); border:1px solid var(--glass-border);">
            <div>
              <div style="display:flex; align-items:center; gap:0.4rem;">
                <strong style="font-size:0.95rem; color:var(--text-primary);">${rev.userName || 'Verified Customer'}</strong>
                <span style="font-size:0.7rem; background:rgba(16,185,129,0.15); color:var(--color-emerald); padding:1px 6px; border-radius:4px; font-weight:700;">✓ Verified Buyer</span>
              </div>
              <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
            </div>
          </div>

          <div style="color:#fbbf24; font-size:0.95rem; font-weight:800; letter-spacing:1px;">
            ${starsHtml}
          </div>
        </div>

        <p style="margin:0.4rem 0 0 0; color:var(--text-secondary); font-size:0.9rem; line-height:1.5;">
          ${rev.comment || 'Great quality product, authentic and fast delivery!'}
        </p>
      </div>
    `;
  }).join("");
};

window.appSubmitProductReview = async function(event, productId) {
  event.preventDefault();
  const nameInput = document.getElementById("reviewUserNameInput");
  const commentInput = document.getElementById("reviewCommentInput");
  const submitBtn = document.getElementById("submitReviewBtn");

  const userName = nameInput?.value.trim() || "Verified Customer";
  const comment = commentInput?.value.trim() || "";

  if (!comment) {
    showToast("Please write a short comment about your experience.", "warning");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing Review...";
  }

  try {
    const currentUser = AuthService.getCurrentUser();
    const reviewData = {
      userId: currentUser ? currentUser.uid : "usr-guest",
      userName: userName,
      userAvatar: currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`,
      rating: selectedReviewRating,
      comment: comment
    };

    const result = await DBService.submitProductReview(productId, reviewData);
    
    // Update local product cache in allProducts array
    const targetIdx = allProducts.findIndex(p => p.id === productId);
    if (targetIdx !== -1 && result.product) {
      allProducts[targetIdx] = { ...allProducts[targetIdx], ...result.product };
      renderProductsGrid();
    }

    // Refresh reviews UI
    const reviews = await DBService.getProductReviews(productId);
    const container = document.getElementById("productReviewsListContainer");
    if (container) {
      container.innerHTML = window.appRenderReviewsHtml(reviews);
    }

    // Reset Form and hide
    if (commentInput) commentInput.value = "";
    window.appToggleWriteReviewForm();

    showToast("🎉 Thank you! Your review has been published successfully.", "success", 4000);
  } catch (err) {
    showToast("Failed to submit review: " + err.message, "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "⭐ Submit Review";
    }
  }
};

window.appOpenProductDetails = async function(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  activeProductModal = product;
  productModalSelectedQty = 1;
  selectedReviewRating = 5;

  const modal = document.getElementById("productDetailsModalOverlay");
  const titleEl = document.getElementById("modalProductTitle");
  const contentEl = document.getElementById("productModalDetailsContent");

  const imagesList = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'];

  const mainImgUrl = imagesList[0];
  const currentUser = AuthService.getCurrentUser();
  const userNameDefault = currentUser ? (currentUser.displayName || currentUser.email.split("@")[0]) : "";

  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const discountPercent = hasDiscount 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  if (titleEl) titleEl.textContent = `${product.title}`;

  if (modal) modal.classList.add("active");

  // Initial render with loading state for reviews
  if (contentEl) {
    contentEl.innerHTML = `
      <div class="product-details-grid">
        <!-- Left: Image Gallery & Assurance -->
        <div>
          <div style="position:relative; overflow:hidden; border-radius:var(--radius-lg); background:var(--bg-elevated); border:1px solid var(--glass-border); margin-bottom:0.75rem;">
            <img id="productModalMainImg" src="${mainImgUrl}" alt="${product.title}" 
              style="width:100%; height:320px; object-fit:cover; display:block; transition:transform 0.4s ease;"
              onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'">
            ${product.badge ? `<span class="product-badge badge-${(product.badge || 'new').toLowerCase()}" style="position:absolute; top:12px; left:12px;">${product.badge}</span>` : ''}
            ${hasDiscount ? `<span style="position:absolute; top:12px; right:12px; background:linear-gradient(135deg, #ef4444, #f43f5e); color:white; font-size:0.75rem; font-weight:800; padding:4px 8px; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.3);">-${discountPercent}% OFF</span>` : ''}
          </div>

          <!-- Thumbnails Row (if multiple images) -->
          ${imagesList.length > 1 ? `
            <div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem; margin-bottom:0.75rem;">
              ${imagesList.map((img, idx) => `
                <button type="button" class="gallery-thumb-btn ${idx === 0 ? 'active' : ''}" onclick="window.appSwitchModalGalleryImage('${img}', this)">
                  <img src="${img}" alt="Thumbnail ${idx+1}" class="gallery-thumb-img">
                </button>
              `).join("")}
            </div>
          ` : ''}

          <!-- Product Badges & Quality Assurance -->
          <div class="product-perks-grid">
            <div class="product-perk-item">
              <span>🚀</span>
              <div>
                <strong style="color:var(--text-primary); display:block; font-size:0.8rem;">Express Dispatch</strong>
                <span>Free across Pakistan</span>
              </div>
            </div>
            <div class="product-perk-item">
              <span>🛡️</span>
              <div>
                <strong style="color:var(--text-primary); display:block; font-size:0.8rem;">2-Year Warranty</strong>
                <span>Official Brand Coverage</span>
              </div>
            </div>
            <div class="product-perk-item">
              <span>🔄</span>
              <div>
                <strong style="color:var(--text-primary); display:block; font-size:0.8rem;">30-Day Returns</strong>
                <span>Hassle-Free Money Back</span>
              </div>
            </div>
            <div class="product-perk-item">
              <span>🔒</span>
              <div>
                <strong style="color:var(--text-primary); display:block; font-size:0.8rem;">100% Genuine</strong>
                <span>Direct Authorized Stock</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Specifications, Pricing, Quantity & Add To Cart -->
        <div style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; flex-wrap:wrap; gap:0.5rem;">
              <span class="cat-pill cat-pill-audio" style="text-transform:uppercase; letter-spacing:0.04em;">${product.category || 'Electronics'}</span>
              <a href="#modalReviewsContainer" style="color:#fbbf24; font-weight:800; text-decoration:none; font-size:0.9rem; display:inline-flex; align-items:center; gap:0.25rem;">
                <span>★ ${product.rating > 0 ? product.rating : '5.0'}</span>
                <span style="color:var(--text-secondary); font-size:0.8rem; font-weight:600;">(${product.reviewsCount || 0} reviews)</span>
              </a>
            </div>

            <h2 style="font-size:1.65rem; font-weight:900; margin-bottom:0.6rem; line-height:1.25; color:var(--text-primary);">${product.title}</h2>

            <!-- Price & Stock Status -->
            <div style="display:flex; align-items:baseline; gap:0.85rem; margin-bottom:0.85rem;">
              <span style="font-size:1.75rem; font-weight:900; color:#38bdf8; font-family:'Space Grotesk',sans-serif;">
                ${formatPKR(product.price)}
              </span>
              ${hasDiscount ? `
                <span style="font-size:1.1rem; color:var(--text-muted); text-decoration:line-through;">
                  ${formatPKR(product.originalPrice)}
                </span>
              ` : ''}
            </div>

            <!-- In Stock Status Badge -->
            <div style="margin-bottom:1rem;">
              ${product.stock > 0 ? `
                <span style="display:inline-flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:700; color:var(--color-emerald); background:rgba(16,185,129,0.12); padding:0.35rem 0.75rem; border-radius:20px; border:1px solid rgba(16,185,129,0.3);">
                  <span style="width:7px; height:7px; border-radius:50%; background:var(--color-emerald);"></span>
                  In Stock (${product.stock} units available) • Ready to ship
                </span>
              ` : `
                <span style="display:inline-flex; align-items:center; gap:0.4rem; font-size:0.82rem; font-weight:700; color:var(--danger); background:rgba(239,68,68,0.12); padding:0.35rem 0.75rem; border-radius:20px; border:1px solid rgba(239,68,68,0.3);">
                  <span style="width:7px; height:7px; border-radius:50%; background:var(--danger);"></span>
                  Currently Out of Stock
                </span>
              `}
            </div>

            <!-- Detailed Description -->
            <div style="background:var(--bg-elevated); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--glass-border); margin-bottom:1.25rem;">
              <h4 style="font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary); margin-bottom:0.4rem;">Product Specifications & Details</h4>
              <p style="color:var(--text-secondary); font-size:0.92rem; line-height:1.6; margin:0; white-space:pre-line;">
                ${product.description || 'Engineered with high-grade components and precision architecture to deliver flagship performance, extreme durability, and maximum satisfaction.'}
              </p>
            </div>
          </div>

          <!-- Quantity Selector & Add To Cart Button -->
          <div style="display:flex; gap:0.75rem; align-items:center; margin-top:0.5rem; flex-wrap:wrap;">
            <div class="quantity-control-wrap">
              <button type="button" class="quantity-btn" onclick="window.appUpdateModalQty(-1)">−</button>
              <input type="number" id="productModalQtyInput" class="quantity-input" value="1" min="1" max="${product.stock || 99}" readonly>
              <button type="button" class="quantity-btn" onclick="window.appUpdateModalQty(1)">+</button>
            </div>

            <button class="btn btn-primary btn-lg" onclick="window.appAddModalProductToCart('${product.id}')" style="flex:1; justify-content:center; padding:0.85rem 1.5rem; font-size:1rem;">
              🛍️ Add to Shopping Bag
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== CUSTOMER REVIEWS & WRITE REVIEW ==================== -->
      <section class="product-reviews-section" id="modalReviewsContainer">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <h3 style="font-size:1.25rem; font-weight:800; margin-bottom:0.25rem;">Customer Ratings & Reviews</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">Real feedback from verified buyers in Pakistan</p>
          </div>

          <button type="button" class="btn btn-secondary btn-sm" id="toggleWriteReviewBtn" onclick="window.appToggleWriteReviewForm()" style="display:inline-flex; align-items:center; gap:0.4rem;">
            <span>✍️</span> Write a Review
          </button>
        </div>

        <!-- Write a Review Form (Collapsible) -->
        <div id="writeReviewFormWrapper" style="display:none; background:var(--bg-elevated); border:1px solid var(--glass-border); border-radius:var(--radius-lg); padding:1.5rem; margin-bottom:1.5rem;">
          <h4 style="font-size:1.05rem; font-weight:800; margin-bottom:0.75rem; color:var(--text-primary);">
            Share Your Experience with "${product.title}"
          </h4>
          
          <form id="productReviewForm" onsubmit="window.appSubmitProductReview(event, '${product.id}')">
            <!-- Star Rating Interactive Selector -->
            <div class="form-group">
              <label class="form-label" style="display:block; margin-bottom:0.4rem;">Overall Rating *</label>
              <div class="star-rating-picker" id="modalStarRatingPicker">
                <span class="star-item active" data-rating="1" onclick="window.appSetReviewStar(1)">★</span>
                <span class="star-item active" data-rating="2" onclick="window.appSetReviewStar(2)">★</span>
                <span class="star-item active" data-rating="3" onclick="window.appSetReviewStar(3)">★</span>
                <span class="star-item active" data-rating="4" onclick="window.appSetReviewStar(4)">★</span>
                <span class="star-item active" data-rating="5" onclick="window.appSetReviewStar(5)">★</span>
                <span id="starRatingLabel" style="font-size:0.85rem; font-weight:700; color:#fbbf24; margin-left:0.5rem; align-self:center;">5.0 (Excellent)</span>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="reviewUserNameInput">Your Name *</label>
                <input type="text" id="reviewUserNameInput" class="form-input" required placeholder="e.g. Faraz Mehmood" value="${userNameDefault}">
              </div>
              <div class="form-group">
                <label class="form-label" for="reviewUserCityInput">City (Optional)</label>
                <input type="text" id="reviewUserCityInput" class="form-input" placeholder="e.g. Karachi / Lahore">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="reviewCommentInput">Your Detailed Review *</label>
              <textarea id="reviewCommentInput" class="form-input" rows="3" required placeholder="Tell other customers what you liked about this product's sound, build quality, or battery life..." style="resize:vertical;"></textarea>
            </div>

            <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
              <button type="button" class="btn btn-secondary" onclick="window.appToggleWriteReviewForm()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="submitReviewBtn">⭐ Submit Review</button>
            </div>
          </form>
        </div>

        <!-- Rendered Reviews List -->
        <div id="productReviewsListContainer">
          <div style="text-align:center; padding:1.5rem; color:var(--text-muted);">Loading reviews...</div>
        </div>
      </section>
    `;
  }

  // Load and render actual reviews from Firestore
  try {
    const reviews = await DBService.getProductReviews(product.id);
    const container = document.getElementById("productReviewsListContainer");
    if (container) {
      container.innerHTML = window.appRenderReviewsHtml(reviews);
    }
  } catch (e) {
    console.warn("Could not load reviews:", e);
  }
};

// ==================== CART STORE ====================
const CartStore = {
  items: [],
  coupon: null,

  init() {
    try {
      this.items = JSON.parse(localStorage.getItem("aura_cart") || "[]");
      this.items.forEach(i => {
        i.qty = i.quantity || i.qty || 1;
        i.quantity = i.qty;
      });
    } catch {
      this.items = [];
    }
  },

  save() {
    localStorage.setItem("aura_cart", JSON.stringify(this.items));
  },

  addItem(product, qty = 1) {
    const existing = this.items.find(i => i.id === product.id);
    const addedQty = Number(qty) || 1;
    if (existing) {
      existing.qty = (existing.qty || existing.quantity || 0) + addedQty;
      existing.quantity = existing.qty;
    } else {
      this.items.push({
        id: product.id,
        title: product.title,
        price: Number(product.price || 0),
        image: (product.images && product.images.length > 0) ? product.images[0] : (product.image || ""),
        category: product.category || "General",
        qty: addedQty,
        quantity: addedQty
      });
    }
    this.save();
  },

  updateQty(productId, qty) {
    const item = this.items.find(i => i.id === productId);
    if (item) {
      item.qty = Number(qty);
      item.quantity = item.qty;
      if (item.qty <= 0) {
        this.items = this.items.filter(i => i.id !== productId);
      }
      this.save();
    }
  },

  removeItem(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
  },

  clear() {
    this.items = [];
    this.coupon = null;
    this.save();
  },

  getItemCount() {
    return this.items.reduce((acc, item) => acc + (item.quantity || item.qty || 1), 0);
  },

  getSubtotal() {
    return this.items.reduce((acc, item) => acc + (item.price * (item.quantity || item.qty || 1)), 0);
  },

  applyCoupon(code) {
    if (code.trim().toUpperCase() === "AURA10") {
      this.coupon = { code: "AURA10", discountPercent: 10, label: "10% Off Cart" };
      return { success: true, coupon: this.coupon };
    }
    return { success: false, message: "Invalid promo code" };
  },

  getTotal() {
    const subtotal = this.getSubtotal();
    if (this.coupon) {
      return subtotal * (1 - (this.coupon.discountPercent / 100));
    }
    return subtotal;
  }
};

function updateCartUI() {
  const badge = document.getElementById("cartBadgeCounter");
  const drawerCount = document.getElementById("cartItemCountBadge");
  const container = document.getElementById("cartItemsContainer");
  const subtotalEl = document.getElementById("cartSubtotalAmount");
  const totalEl = document.getElementById("cartTotalAmount");
  const discountRow = document.getElementById("cartDiscountRow");
  const discountAmountEl = document.getElementById("cartDiscountAmount");

  const totalCount = CartStore.items.reduce((acc, i) => acc + i.qty, 0);
  if (badge) badge.textContent = totalCount;
  if (drawerCount) drawerCount.textContent = totalCount;

  const subtotal = CartStore.getSubtotal();
  const total = CartStore.getTotal();

  if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
  if (totalEl) totalEl.textContent = `Rs. ${Math.round(total).toLocaleString()}`;

  if (CartStore.coupon && discountRow && discountAmountEl) {
    discountRow.style.display = "flex";
    const disc = subtotal - total;
    discountAmountEl.textContent = `-Rs. ${Math.round(disc).toLocaleString()}`;
  } else if (discountRow) {
    discountRow.style.display = "none";
  }

  if (!container) return;

  if (CartStore.items.length === 0) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding:2rem; color:var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        <h4>Your cart is empty</h4>
        <p style="font-size:0.85rem; margin-top:0.3rem;">Explore our high-performance collection and add items.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = CartStore.items.map(item => `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.title}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-title">${item.title}</div>
        <div class="cart-item-price">Rs. ${item.price.toLocaleString()}</div>
        <div class="cart-qty-control">
          <div class="cart-qty-btn" onclick="window.appCartChangeQty('${item.id}', -1)">-</div>
          <span style="font-size:0.85rem; font-weight:700;">${item.qty}</span>
          <div class="cart-qty-btn" onclick="window.appCartChangeQty('${item.id}', 1)">+</div>
        </div>
      </div>
      <button onclick="window.appCartRemove('${item.id}')" style="color:var(--text-muted); cursor:pointer; font-size:1.1rem; position:absolute; top:0.5rem; right:0.5rem;">&times;</button>
    </div>
  `).join("");
}

window.appCartChangeQty = function(id, delta) {
  const item = CartStore.items.find(i => i.id === id);
  if (item) {
    CartStore.updateQty(id, item.qty + delta);
    updateCartUI();
  }
};

window.appCartRemove = function(id) {
  CartStore.removeItem(id);
  updateCartUI();
  showToast("Item removed from cart", "info");
};

function openCartDrawer() {
  document.getElementById("cartDrawerOverlay")?.classList.add("active");
}

function closeCartDrawer() {
  document.getElementById("cartDrawerOverlay")?.classList.remove("active");
}

// ==================== CHECKOUT & ORDER PLACEMENT ====================
function openCheckoutModal() {
  if (CartStore.items.length === 0) {
    showToast("Your cart is empty! Please add products before checking out.", "error");
    return;
  }

  closeCartDrawer();

  // Render checkout items with pictures
  const itemsContainer = document.getElementById("checkoutItemsList");
  const itemsBadge = document.getElementById("checkoutItemsBadge");
  const subtotalEl = document.getElementById("checkoutSubtotalText");
  const discountRow = document.getElementById("checkoutDiscountRow");
  const discountEl = document.getElementById("checkoutDiscountText");
  const payableTotal = document.getElementById("checkoutPayableTotal");

  if (itemsBadge) itemsBadge.textContent = `${CartStore.getItemCount()} Item${CartStore.getItemCount() > 1 ? 's' : ''}`;

  if (itemsContainer) {
    itemsContainer.innerHTML = CartStore.items.map(item => {
      const imgUrl = (item.images && item.images.length > 0) 
        ? item.images[0] 
        : (item.image || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80");
      
      return `
        <div style="display:flex; align-items:center; gap:0.75rem; background:var(--bg-card); border:1px solid var(--glass-border); border-radius:var(--radius-sm); padding:0.6rem;">
          <img src="${imgUrl}" alt="${item.title}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid var(--glass-border); flex-shrink:0;">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:0.84rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${item.title}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-top:3px;">
              <span>Qty: <strong style="color:var(--text-primary);">${item.quantity}</strong></span>
              <span style="color:#38bdf8; font-weight:800;">Rs. ${(item.price * item.quantity).toLocaleString()}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  const subtotal = CartStore.getSubtotal();
  const total = Math.round(CartStore.getTotal());
  const discount = subtotal - total;

  if (subtotalEl) subtotalEl.textContent = `Rs. ${subtotal.toLocaleString()}`;
  if (discountRow && discountEl) {
    if (discount > 0) {
      discountRow.style.display = "flex";
      discountEl.textContent = `-Rs. ${discount.toLocaleString()}`;
    } else {
      discountRow.style.display = "none";
    }
  }
  if (payableTotal) payableTotal.textContent = `Rs. ${total.toLocaleString()}`;

  // Pre-fill user data if available
  const user = AuthService.getCurrentUser();
  if (user) {
    const emailInput = document.getElementById("checkoutCustomerEmail");
    if (emailInput && !emailInput.value) emailInput.value = user.email || "";
    const nameInput = document.getElementById("checkoutCustomerName");
    if (nameInput && !nameInput.value && user.displayName) nameInput.value = user.displayName;
  }

  document.getElementById("checkoutModalOverlay")?.classList.add("active");
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById("submitOrderBtn");
  const originalHtml = btn ? btn.innerHTML : "Confirm & Place Order";

  if (btn) {
    btn.disabled = true;
    btn.classList.add("btn-processing");
    btn.innerHTML = `<span class="spinner-icon"></span> Confirming Order...`;
    if (typeof gsap !== "undefined") {
      gsap.fromTo(btn, { scale: 0.93 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
    }
  }

  const user = AuthService.getCurrentUser();
  const userId = user ? (user.uid || user.id || "usr-member") : "usr-guest";
  const fullName = document.getElementById("checkoutCustomerName").value.trim();
  const email = document.getElementById("checkoutCustomerEmail").value.trim();
  const phone = document.getElementById("checkoutCustomerPhone").value.trim();
  const address = document.getElementById("checkoutCustomerAddress").value.trim();
  const city = document.getElementById("checkoutCustomerCity").value.trim();
  const paymentMethod = document.getElementById("checkoutPaymentMethod").value;

  const orderData = {
    customer: {
      userId: userId,
      name: fullName,
      email: email,
      phone: phone,
      address: `${address}, ${city}`
    },
    items: CartStore.items.map(item => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      image: (item.images && item.images.length > 0) ? item.images[0] : (item.image || "")
    })),
    subtotal: CartStore.getSubtotal(),
    shipping: 0,
    discount: CartStore.coupon ? (CartStore.getSubtotal() - CartStore.getTotal()) : 0,
    total: Math.round(CartStore.getTotal()),
    status: "Pending",
    paymentMethod: paymentMethod,
    createdAt: new Date().toISOString()
  };

  try {
    const createdOrder = await DBService.createOrder(orderData);
    CartStore.clear();
    updateCartUI();

    // Satisfying green success transition on the button
    if (btn) {
      btn.classList.remove("btn-processing");
      btn.classList.add("btn-success-state");
      btn.innerHTML = `<span style="font-size:1.15rem; margin-right:6px;">✓</span> Order Confirmed!`;
    }

    // Brief 500ms delay to let the customer enjoy the confirmation animation
    await new Promise(res => setTimeout(res, 500));

    document.getElementById("checkoutModalOverlay")?.classList.remove("active");
    const successIdEl = document.getElementById("orderSuccessId");
    if (successIdEl) successIdEl.textContent = createdOrder.id || `AUR-${Date.now().toString().slice(-6)}`;
    
    const successModal = document.getElementById("orderSuccessModalOverlay");
    if (successModal) {
      successModal.classList.add("active");
      if (typeof gsap !== "undefined") {
        gsap.fromTo(successModal.querySelector(".modal-container"),
          { scale: 0.85, opacity: 0, y: 20 },
          { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.6)" }
        );
      }
    }

    showToast("🎉 Order placed successfully and recorded in Firestore!", "success", 4000);
  } catch (err) {
    console.error("Order error:", err);
    showToast(err.message || "Failed to record order. Please try again.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("btn-processing", "btn-success-state");
      btn.innerHTML = originalHtml;
    }
  }
}

// ==================== AUTHENTICATION & GATE ====================
// ==================== AUTHENTICATION & GATE ====================
function checkAuthState() {
  const user = AuthService.getCurrentUser();
  const authBtnText = document.getElementById("authButtonText");
  const authBtn = document.getElementById("openAuthModalBtn");

  if (user) {
    if (authBtnText) authBtnText.textContent = `👤 ${user.displayName || user.email.split("@")[0]}`;
    if (authBtn) {
      authBtn.style.background = "";
      authBtn.style.color = "";
      authBtn.style.border = "";
      authBtn.title = "Account Settings";
    }
  } else {
    if (authBtnText) authBtnText.textContent = "Sign In";
    if (authBtn) {
      authBtn.style.background = "";
      authBtn.style.color = "";
      authBtn.style.border = "";
      authBtn.title = "Sign In";
    }
  }
}

function openAuthModal() {
  const user = AuthService.getCurrentUser();
  const title = document.getElementById("authModalTitle");
  const activeCard = document.getElementById("authActiveUserCard");
  const avatarImg = document.getElementById("authActiveUserAvatar");
  const nameEl = document.getElementById("authActiveUserName");
  const emailEl = document.getElementById("authActiveUserEmail");
  const tabsContainer = document.getElementById("authTabsContainer");

  if (user) {
    if (title) title.textContent = `My Account`;
    if (activeCard) activeCard.style.display = "block";
    if (avatarImg) avatarImg.src = user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`;
    if (nameEl) nameEl.textContent = user.displayName || user.email.split("@")[0];
    if (emailEl) emailEl.textContent = user.email;

    // Hide forms when viewing active logged in card
    const loginForm = document.getElementById("loginForm");
    const signUpForm = document.getElementById("signUpForm");
    if (loginForm) loginForm.style.display = "none";
    if (signUpForm) signUpForm.style.display = "none";
    if (tabsContainer) tabsContainer.style.display = "none";
  } else {
    if (title) title.textContent = "Welcome to NextGen Store";
    if (activeCard) activeCard.style.display = "none";
    if (tabsContainer) tabsContainer.style.display = "flex";
    // Default to Customer Login tab
    document.getElementById("tabLoginBtn")?.click();
  }

  document.getElementById("authModalOverlay")?.classList.add("active");
}

// ==================== FAQ ACCORDION LOGIC ====================
function setupFAQAccordion() {
  document.querySelectorAll(".faq-question").forEach(q => {
    q.addEventListener("click", () => {
      const item = q.parentElement;
      const isActive = item.classList.contains("active");
      document.querySelectorAll(".faq-item").forEach(i => i.classList.remove("active"));
      if (!isActive) {
        item.classList.add("active");
      }
    });
  });
}

// ==================== MY ORDERS MODAL ====================
async function openMyOrdersModal() {
  const user = AuthService.getCurrentUser();
  const container = document.getElementById("myOrdersContainer");
  const modal = document.getElementById("myOrdersModalOverlay");

  if (!modal || !container) return;

  container.innerHTML = `<div style="text-align:center; padding:2rem;"><p>Loading orders...</p></div>`;
  modal.classList.add("active");

  try {
    const orders = await DBService.getOrders();
    const userOrders = user 
      ? orders.filter(o => o.customerEmail?.toLowerCase() === user.email.toLowerCase())
      : orders.slice(0, 5);

    if (userOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--text-muted);">
          <h4>No past orders found</h4>
          <p style="font-size:0.85rem;">Orders you place with this email will appear here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = userOrders.map(order => `
      <div style="background:var(--bg-card); border:1px solid var(--glass-border); border-radius:var(--radius-sm); padding:1rem; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-family:'Space Grotesk',monospace; font-weight:800; color:var(--color-cyan);">${order.id}</span>
          <span style="font-size:0.75rem; background:rgba(6,182,212,0.15); color:var(--color-cyan); padding:2px 8px; border-radius:10px; font-weight:700;">${order.status || 'Pending'}</span>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.5rem;">
          Placed on: ${new Date(order.createdAt).toLocaleDateString()} • Items: ${order.items ? order.items.length : 0}
        </div>
        <div style="font-weight:800; color:#38bdf8; font-size:1rem;">
          Total: Rs. ${order.total ? order.total.toLocaleString() : '0'}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p style="color:var(--danger);">Error loading your orders.</p>`;
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Theme Toggle
  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);

  // Cart Drawer Triggers
  document.getElementById("cartToggleBtn")?.addEventListener("click", openCartDrawer);
  document.getElementById("closeCartDrawerBtn")?.addEventListener("click", closeCartDrawer);
  document.getElementById("cartDrawerOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "cartDrawerOverlay") closeCartDrawer();
  });

  // Global Search Input
  document.getElementById("globalSearchInput")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderFilteredProducts();
  });

  // Sort Select
  document.getElementById("catalogSortSelect")?.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderFilteredProducts();
  });

  // Category Capsules Click
  document.querySelectorAll(".category-capsule").forEach(capsule => {
    capsule.addEventListener("click", () => {
      window.appFilterCategory(capsule.dataset.category);
    });
  });

  // Promo Coupon Copy
  document.getElementById("promoCopyCouponBtn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("AURA10");
      showToast("🎉 Coupon code 'AURA10' copied! Paste it in your cart for 10% OFF.", "success", 4000);
    } catch {
      showToast("Coupon code: AURA10", "info");
    }
  });

  // Coupon Application in Cart
  document.getElementById("applyCouponBtn")?.addEventListener("click", () => {
    const input = document.getElementById("couponCodeInput");
    const status = document.getElementById("couponStatusMessage");
    if (!input || !status) return;

    const res = CartStore.applyCoupon(input.value);
    if (res.success) {
      status.style.color = "var(--color-emerald)";
      status.textContent = `✓ ${res.coupon.label}`;
      updateCartUI();
      showToast("10% discount applied to your cart!", "success");
    } else {
      status.style.color = "var(--danger)";
      status.textContent = res.message;
      showToast(res.message, "error");
    }
  });

  // Checkout Modal Triggers
  document.getElementById("proceedCheckoutBtn")?.addEventListener("click", openCheckoutModal);
  document.getElementById("closeCheckoutModalBtn")?.addEventListener("click", () => {
    document.getElementById("checkoutModalOverlay")?.classList.remove("active");
  });
  document.getElementById("cancelCheckoutBtn")?.addEventListener("click", () => {
    document.getElementById("checkoutModalOverlay")?.classList.remove("active");
    openCartDrawer();
  });
  document.getElementById("checkoutForm")?.addEventListener("submit", handleCheckoutSubmit);

  // Success Modal
  document.getElementById("closeOrderSuccessBtn")?.addEventListener("click", () => {
    document.getElementById("orderSuccessModalOverlay")?.classList.remove("active");
  });

  // Product Details Modal
  document.getElementById("closeProductDetailsModalBtn")?.addEventListener("click", () => {
    document.getElementById("productDetailsModalOverlay")?.classList.remove("active");
  });
  document.getElementById("productDetailsModalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "productDetailsModalOverlay") {
      document.getElementById("productDetailsModalOverlay")?.classList.remove("active");
    }
  });

  // Auth Triggers
  document.getElementById("openAuthModalBtn")?.addEventListener("click", openAuthModal);
  document.getElementById("closeAuthModalBtn")?.addEventListener("click", () => {
    document.getElementById("authModalOverlay")?.classList.remove("active");
  });
  document.getElementById("authModalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "authModalOverlay") {
      document.getElementById("authModalOverlay")?.classList.remove("active");
    }
  });

  // Customer Login Tab
  document.getElementById("tabLoginBtn")?.addEventListener("click", () => {
    document.getElementById("tabLoginBtn")?.classList.add("active");
    document.getElementById("tabSignUpBtn")?.classList.remove("active");
    document.getElementById("loginForm").style.display = "block";
    document.getElementById("signUpForm").style.display = "none";
    const alert = document.getElementById("loginErrorAlert");
    if (alert) alert.style.display = "none";
  });

  // Customer Sign Up Tab
  document.getElementById("tabSignUpBtn")?.addEventListener("click", () => {
    document.getElementById("tabSignUpBtn")?.classList.add("active");
    document.getElementById("tabLoginBtn")?.classList.remove("active");
    document.getElementById("loginForm").style.display = "none";
    document.getElementById("signUpForm").style.display = "block";
    const alert = document.getElementById("signUpErrorAlert");
    if (alert) alert.style.display = "none";
  });

  // Active Profile Card Actions
  document.getElementById("authActiveOrdersBtn")?.addEventListener("click", () => {
    document.getElementById("authModalOverlay")?.classList.remove("active");
    setTimeout(() => openMyOrdersModal(), 200);
  });
  document.getElementById("authActiveSignOutBtn")?.addEventListener("click", async () => {
    await AuthService.logout();
    checkAuthState();
    showToast("Signed out successfully.", "info");
    openAuthModal();
  });

  // Login Form Submission
  document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPassword").value;
    const alertBox = document.getElementById("loginErrorAlert");
    const submitBtn = document.getElementById("loginSubmitBtn");

    if (alertBox) alertBox.style.display = "none";
    if (submitBtn) submitBtn.disabled = true;

    try {
      const loggedUser = await AuthService.login(email, pass);
      checkAuthState();
      document.getElementById("authModalOverlay")?.classList.remove("active");

      // If logged-in user is an Admin, immediately redirect to Admin Module
      if (loggedUser && loggedUser.isAdmin) {
        showToast(`👑 Welcome Administrator! Redirecting to Admin Dashboard...`, "success", 2500);
        setTimeout(() => {
          window.location.href = "./admin/index.html";
        }, 600);
        return;
      }

      showToast(`Welcome back, ${loggedUser?.displayName || email}!`, "success");

      // If user was attempting to checkout, resume checkout flow smoothly
      if (CartStore.items.length > 0) {
        setTimeout(() => openCheckoutModal(), 300);
      }
    } catch (err) {
      const errMsg = err.message || "Invalid email or password. Please try again.";
      if (alertBox) {
        alertBox.innerHTML = `<span>⚠️</span> <span>${errMsg}</span>`;
        alertBox.style.display = "flex";
        if (typeof gsap !== "undefined") {
          gsap.fromTo(alertBox, { x: -8 }, { x: 8, duration: 0.08, repeat: 4, yoyo: true });
        }
      }
      showToast(errMsg, "error", 4000);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Sign Up Form Submission
  document.getElementById("signUpForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signUpName").value;
    const email = document.getElementById("signUpEmail").value;
    const pass = document.getElementById("signUpPassword").value;
    const alertBox = document.getElementById("signUpErrorAlert");
    const submitBtn = document.getElementById("signUpSubmitBtn");

    if (alertBox) alertBox.style.display = "none";
    if (submitBtn) submitBtn.disabled = true;

    try {
      const newUser = await AuthService.signUp(name, email, pass);
      checkAuthState();
      document.getElementById("authModalOverlay")?.classList.remove("active");

      // If registered user is an Admin, immediately redirect to Admin Module
      if (newUser && newUser.isAdmin) {
        showToast(`👑 Welcome Administrator! Redirecting to Admin Dashboard...`, "success", 2500);
        setTimeout(() => {
          window.location.href = "./admin/index.html";
        }, 600);
        return;
      }

      showToast(`Welcome to NextGen Store, ${name}!`, "success");

      // If user was attempting to checkout, resume checkout flow smoothly
      if (CartStore.items.length > 0) {
        setTimeout(() => openCheckoutModal(), 300);
      }
    } catch (err) {
      const errMsg = err.message || "Failed to create account. Please check your information.";
      if (alertBox) {
        alertBox.innerHTML = `<span>⚠️</span> <span>${errMsg}</span>`;
        alertBox.style.display = "flex";
        if (typeof gsap !== "undefined") {
          gsap.fromTo(alertBox, { x: -8 }, { x: 8, duration: 0.08, repeat: 4, yoyo: true });
        }
      }
      showToast(errMsg, "error", 4000);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // My Orders Trigger
  document.getElementById("myOrdersBtn")?.addEventListener("click", openMyOrdersModal);
  document.getElementById("closeMyOrdersModalBtn")?.addEventListener("click", () => {
    document.getElementById("myOrdersModalOverlay")?.classList.remove("active");
  });
}

// ==================== TOAST SYSTEM ====================
export function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️";

  toast.innerHTML = `
    <span style="font-weight:800; font-size:1.15rem; flex-shrink:0;">${icon}</span>
    <span style="font-size:0.9rem; font-weight:600; line-height:1.35;">${message}</span>
  `;

  container.appendChild(toast);

  if (typeof gsap !== "undefined") {
    gsap.fromTo(toast, { y: -20, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" });
  }

  setTimeout(() => {
    if (typeof gsap !== "undefined") {
      gsap.to(toast, { y: -15, opacity: 0, scale: 0.95, duration: 0.25, onComplete: () => toast.remove() });
    } else {
      toast.remove();
    }
  }, duration);
}

export function formatPKR(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString()}`;
}
