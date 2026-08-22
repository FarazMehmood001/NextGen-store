// shared/services/db-service.js
import {
  db,
  isFirebaseConnected,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collectionGroup
} from "../config/firebase-config.js";

const LOCAL_PRODUCTS_KEY = "aura_products_cache";
const LOCAL_ORDERS_KEY = "aura_orders_cache";

function getLocalItems(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalItems(key, items) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.warn("localStorage write error:", e);
  }
}

export class DBService {
  static async init() {
    if (isFirebaseConnected && db) {
      try {
        // Ensure Admin Document exists in Firestore: admin/inventory
        await setDoc(doc(db, "admin", "inventory"), {
          name: "Super Administrator",
          email: "admin@gmail.com",
          password: "admin123",
          role: "admin",
          isAdmin: true,
          photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin@gmail.com",
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore admin init check failed, fallback active:", err);
      }
    }
  }

  // ==================== ADMIN PROFILE (FIRESTORE: collection 'admin') ====================
  static async getAdminProfile(userId = null) {
    if (isFirebaseConnected && db) {
      try {
        // 1. Primary: Query all documents in the 'admin' collection
        const adminCol = collection(db, "admin");
        const adminDocsSnap = await getDocs(adminCol);
        if (!adminDocsSnap.empty) {
          for (const docSnap of adminDocsSnap.docs) {
            const data = docSnap.data();
            if (data) {
              const name = data.name || data.displayName || data.adminName || data.fullName;
              const email = data.email || data.adminEmail;
              const photo = data.photoURL || data.image || data.avatar || data.picture || data.photo;
              if (name || email) {
                return {
                  name: name || "Administrator",
                  displayName: name || "Administrator",
                  email: email || "admin@gmail.com",
                  photoURL: photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email || 'admin@gmail.com'}`,
                  role: data.role || "Executive Admin",
                  isAdmin: true
                };
              }
            }
          }
        }

        // 2. Direct document check: admin/inventory
        const adminDocRef = doc(db, "admin", "inventory");
        const adminSnap = await getDoc(adminDocRef);
        if (adminSnap.exists()) {
          const data = adminSnap.data();
          const name = data.name || data.displayName || data.adminName || data.fullName;
          const email = data.email || data.adminEmail;
          const photo = data.photoURL || data.image || data.avatar || data.picture;
          return {
            name: name || "Administrator",
            displayName: name || "Administrator",
            email: email || "admin@gmail.com",
            photoURL: photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email || 'admin@gmail.com'}`,
            role: data.role || "Executive Admin",
            isAdmin: true
          };
        }

        // 3. Fallback: check users collection
        if (userId) {
          const userDocRef = doc(db, "users", userId);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            const uData = userSnap.data();
            return {
              name: uData.displayName || uData.name || "Administrator",
              displayName: uData.displayName || uData.name || "Administrator",
              email: uData.email || "admin@gmail.com",
              photoURL: uData.photoURL || uData.image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uData.email || 'admin@gmail.com'}`,
              role: uData.role || "Administrator",
              isAdmin: true
            };
          }
        }
      } catch (e) {
        console.warn("Error fetching admin profile from Firestore:", e);
      }
    }

    return {
      name: "Administrator",
      displayName: "Administrator",
      email: "admin@gmail.com",
      photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin@gmail.com",
      role: "Administrator",
      isAdmin: true
    };
  }



  // ==================== PRODUCTS (SUBCOLLECTION: admin/inventory/products) ====================

  static async getProducts() {
    if (isFirebaseConnected && db) {
      try {
        const prodCol = collection(db, "admin", "inventory", "products");
        let snapshot = await getDocs(prodCol);

        // Fallback check if stored under collectionGroup
        if (snapshot.empty) {
          try {
            snapshot = await getDocs(collectionGroup(db, "products"));
          } catch (cg) { }
        }

        const products = [];
        snapshot.forEach(docSnap => {
          products.push({ id: docSnap.id, ...docSnap.data() });
        });

        if (products.length > 0) {
          products.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          saveLocalItems(LOCAL_PRODUCTS_KEY, products);
          return products;
        }
      } catch (e) {
        console.warn("Error fetching from admin/inventory/products Firestore, loading cached data:", e);
      }
    }

    const cached = getLocalItems(LOCAL_PRODUCTS_KEY);
    if (cached && cached.length > 0) {
      return cached;
    }

    // Seed default flagship products
    saveLocalItems(LOCAL_PRODUCTS_KEY, DEFAULT_PRODUCTS);
    if (isFirebaseConnected && db) {
      try {
        for (const p of DEFAULT_PRODUCTS) {
          await setDoc(doc(db, "admin", "inventory", "products", p.id), p, { merge: true });
        }
      } catch (e) {
        console.warn("Error seeding default products to Firestore:", e);
      }
    }
    return DEFAULT_PRODUCTS;
  }

  static async getProductById(id) {
    if (isFirebaseConnected && db) {
      try {
        const docRef = doc(db, "admin", "inventory", "products", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (e) {
        console.warn("Firestore getProduct error:", e);
      }
    }
    const products = getLocalItems(LOCAL_PRODUCTS_KEY);
    return products.find(p => p.id === id) || null;
  }

  static async addProduct(productData) {
    const newId = "prod-" + Date.now().toString().slice(-6);
    const product = {
      id: newId,
      title: productData.title.trim(),
      price: parseFloat(productData.price) || 0,
      originalPrice: productData.originalPrice ? parseFloat(productData.originalPrice) : parseFloat(productData.price),
      category: productData.category.trim(),
      image: productData.image.trim() || (productData.images && productData.images[0]) || "",
      images: Array.isArray(productData.images) && productData.images.length > 0 ? productData.images : [productData.image],
      description: productData.description.trim(),
      rating: 0,
      reviewsCount: 0,
      stock: parseInt(productData.stock) || 10,
      featured: Boolean(productData.featured),
      badge: productData.badge || "New",
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
      try {
        // Dual-write: Root collection 'products' AND subcollection 'admin/inventory/products'
        await setDoc(doc(db, "products", newId), product);
        await setDoc(doc(db, "admin", "inventory", "products", newId), product);
        console.log(`✅ Product ${newId} saved to Firestore collections: products/${newId}`);
      } catch (e) {
        console.warn("Error saving product to Firestore, saving locally:", e);
      }
    }

    const current = getLocalItems(LOCAL_PRODUCTS_KEY);
    current.unshift(product);
    saveLocalItems(LOCAL_PRODUCTS_KEY, current);

    window.dispatchEvent(new CustomEvent("aura_products_changed", { detail: { action: "add", product } }));
    return product;
  }

  static async updateProduct(id, updates) {
    const sanitizedUpdates = { ...updates };
    if (sanitizedUpdates.price !== undefined) sanitizedUpdates.price = parseFloat(sanitizedUpdates.price) || 0;
    if (sanitizedUpdates.originalPrice !== undefined) sanitizedUpdates.originalPrice = parseFloat(sanitizedUpdates.originalPrice) || 0;
    if (sanitizedUpdates.stock !== undefined) sanitizedUpdates.stock = parseInt(sanitizedUpdates.stock) || 0;
    if (sanitizedUpdates.rating !== undefined) sanitizedUpdates.rating = parseFloat(sanitizedUpdates.rating) || 0;
    if (sanitizedUpdates.reviewsCount !== undefined) sanitizedUpdates.reviewsCount = parseInt(sanitizedUpdates.reviewsCount) || 0;
    sanitizedUpdates.updatedAt = new Date().toISOString();

    if (isFirebaseConnected && db) {
      try {
        // Dual-update: Root collection 'products' AND subcollection 'admin/inventory/products'
        await setDoc(doc(db, "products", id), sanitizedUpdates, { merge: true });
        await setDoc(doc(db, "admin", "inventory", "products", id), sanitizedUpdates, { merge: true });
        console.log(`✅ Product ${id} updated in Firestore`);
      } catch (e) {
        console.warn("Error updating product in Firestore, saving locally:", e);
      }
    }

    const current = getLocalItems(LOCAL_PRODUCTS_KEY);
    const idx = current.findIndex(p => p.id === id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...sanitizedUpdates };
      saveLocalItems(LOCAL_PRODUCTS_KEY, current);
      window.dispatchEvent(new CustomEvent("aura_products_changed", { detail: { action: "update", product: current[idx] } }));
      return current[idx];
    }
    return null;
  }

  static async deleteProduct(id) {
    if (isFirebaseConnected && db) {
      try {
        // Dual-delete: Root collection 'products' AND subcollection 'admin/inventory/products'
        await deleteDoc(doc(db, "products", id));
        await deleteDoc(doc(db, "admin", "inventory", "products", id));
        console.log(`🗑️ Product ${id} deleted from Firestore`);
      } catch (e) {
        console.warn("Error deleting product from Firestore:", e);
      }
    }

    const current = getLocalItems(LOCAL_PRODUCTS_KEY);
    const filtered = current.filter(p => p.id !== id);
    saveLocalItems(LOCAL_PRODUCTS_KEY, filtered);

    window.dispatchEvent(new CustomEvent("aura_products_changed", { detail: { action: "delete", id } }));
    return true;
  }

  // ==================== PRODUCT RATINGS & REVIEWS ====================

  static async getProductReviews(productId) {
    const key = `aura_reviews_${productId}`;
    let reviews = [];

    if (isFirebaseConnected && db) {
      try {
        const revCol = collection(db, "admin", "inventory", "products", productId, "reviews");
        const snap = await getDocs(revCol);
        snap.forEach(docSnap => {
          reviews.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (reviews.length > 0) {
          reviews.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          saveLocalItems(key, reviews);
          return reviews;
        }
      } catch (e) {
        console.warn("Firestore getProductReviews error:", e);
      }
    }

    const cached = getLocalItems(key);
    if (cached && cached.length > 0) {
      return cached.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    return [];
  }

  static async submitProductReview(productId, reviewData) {
    const reviewId = "rev-" + Date.now().toString().slice(-6);
    const review = {
      id: reviewId,
      productId: productId,
      userId: reviewData.userId || "usr-guest",
      userName: reviewData.userName?.trim() || "Verified Buyer",
      userAvatar: reviewData.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reviewData.userName || 'user'}`,
      rating: parseFloat(reviewData.rating) || 5,
      comment: reviewData.comment ? reviewData.comment.trim() : "",
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
      try {
        const revRef = doc(db, "admin", "inventory", "products", productId, "reviews", reviewId);
        await setDoc(revRef, review);
      } catch (e) {
        console.warn("Firestore review save error:", e);
      }
    }

    // Save to local reviews cache
    const key = `aura_reviews_${productId}`;
    const currentReviews = getLocalItems(key) || [];
    currentReviews.unshift(review);
    saveLocalItems(key, currentReviews);

    const product = await this.getProductById(productId);
    if (product) {
      const prevCount = product.reviewsCount || 0;
      const prevRating = product.rating || 0;
      const newCount = prevCount + 1;
      const newRating = Number(((prevRating * prevCount + review.rating) / newCount).toFixed(1));

      await this.updateProduct(productId, {
        rating: newRating,
        reviewsCount: newCount
      });
      return { product: { ...product, rating: newRating, reviewsCount: newCount }, review, allReviews: currentReviews };
    }
    return { review, allReviews: currentReviews };
  }

  // ==================== ORDERS ====================

  static async getOrders(userId = null) {
    if (isFirebaseConnected && db) {
      try {
        let orders = [];

        // Check root 'orders' collection first
        try {
          const rootOrdersSnap = await getDocs(collection(db, "orders"));
          rootOrdersSnap.forEach(docSnap => {
            orders.push({ id: docSnap.id, ...docSnap.data() });
          });
        } catch (rErr) { }

        if (userId) {
          try {
            const userOrdersCol = collection(db, "users", userId, "orders");
            const snap = await getDocs(userOrdersCol);
            snap.forEach(docSnap => {
              if (!orders.some(o => o.id === docSnap.id)) {
                orders.push({ id: docSnap.id, ...docSnap.data() });
              }
            });
          } catch (uErr) { }
          orders = orders.filter(o => o.customer?.userId === userId || o.userId === userId);
        } else {
          try {
            const allSubOrders = await getDocs(collectionGroup(db, "orders"));
            allSubOrders.forEach(docSnap => {
              if (!orders.some(o => o.id === docSnap.id)) {
                orders.push({ id: docSnap.id, ...docSnap.data() });
              }
            });
          } catch (cgErr) { }
        }

        if (orders.length > 0) {
          orders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
          saveLocalItems(LOCAL_ORDERS_KEY, orders);
          return orders;
        }
      } catch (e) {
        console.warn("Error fetching orders from Firestore, loading cached data:", e);
      }
    }
    const local = getLocalItems(LOCAL_ORDERS_KEY);
    if (userId) {
      return local.filter(o => o.customer?.userId === userId || o.userId === userId || o.customer?.email?.toLowerCase() === userId.toLowerCase());
    }
    return local.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  static async createOrder(orderPayload) {
    const orderId = "ORD-" + Math.floor(100000 + Math.random() * 900000);
    const cust = orderPayload.customer || {};
    const userId = cust.userId || orderPayload.userId || "usr-guest";
    const custName = cust.name || orderPayload.customerName || "Customer";
    const custEmail = cust.email || orderPayload.customerEmail || "";
    const custPhone = cust.phone || orderPayload.customerPhone || "";
    const custAddress = cust.address || orderPayload.shippingAddress || "";

    const newOrder = {
      id: orderId,
      userId: userId,
      customer: {
        userId: userId,
        name: custName,
        email: custEmail,
        phone: custPhone,
        address: custAddress
      },
      items: orderPayload.items || [],
      subtotal: parseFloat(orderPayload.subtotal || 0),
      shipping: parseFloat(orderPayload.shipping || 0),
      discount: parseFloat(orderPayload.discount || 0),
      total: parseFloat(orderPayload.total || 0),
      status: "Pending",
      paymentMethod: orderPayload.paymentMethod || "Cash on Delivery",
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
      try {
        // Dual-write: Root collection 'orders' AND subcollection 'users/{userId}/orders/{orderId}'
        await setDoc(doc(db, "orders", orderId), newOrder);
        await setDoc(doc(db, "users", userId, "orders", orderId), newOrder);
        console.log(`✅ Order ${orderId} saved to Firestore collections: orders/${orderId}`);
      } catch (e) {
        console.warn("Error writing order to Firestore, saving locally:", e);
      }
    }

    const currentOrders = getLocalItems(LOCAL_ORDERS_KEY);
    currentOrders.unshift(newOrder);
    saveLocalItems(LOCAL_ORDERS_KEY, currentOrders);

    // Decrement stock for purchased items
    for (const item of orderPayload.items) {
      const product = await this.getProductById(item.id);
      if (product && product.stock !== undefined) {
        const newStock = Math.max(0, product.stock - item.quantity);
        await this.updateProduct(item.id, { stock: newStock });
      }
    }

    window.dispatchEvent(new CustomEvent("aura_orders_changed", { detail: { action: "create", order: newOrder } }));
    return newOrder;
  }

  static async updateOrderStatus(orderId, status, userId = null) {
    const orders = getLocalItems(LOCAL_ORDERS_KEY);
    const targetOrder = orders.find(o => o.id === orderId);
    const targetUserId = userId || targetOrder?.customer?.userId || targetOrder?.userId || "usr-guest";

    if (isFirebaseConnected && db) {
      try {
        // Dual-update root 'orders' and user subcollection
        await updateDoc(doc(db, "orders", orderId), { status }).catch(() => { });
        if (targetUserId) {
          await updateDoc(doc(db, "users", targetUserId, "orders", orderId), { status }).catch(() => { });
        }
      } catch (e) {
        console.warn("Error updating order in Firestore, updating locally:", e);
      }
    }

    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = status;
      saveLocalItems(LOCAL_ORDERS_KEY, orders);
      window.dispatchEvent(new CustomEvent("aura_orders_changed", { detail: { action: "update_status", orderId, status } }));
      return orders[idx];
    }
    return null;
  }

  static async deleteOrder(orderId, userId = null) {
    const orders = getLocalItems(LOCAL_ORDERS_KEY);
    const targetOrder = orders.find(o => o.id === orderId);
    const targetUserId = userId || targetOrder?.customer?.userId || targetOrder?.userId || "usr-guest";

    if (isFirebaseConnected && db) {
      try {
        await deleteDoc(doc(db, "orders", orderId)).catch(() => { });
        if (targetUserId) {
          await deleteDoc(doc(db, "users", targetUserId, "orders", orderId)).catch(() => { });
        }
      } catch (e) {
        console.warn("Error deleting order from Firestore:", e);
      }
    }

    const filtered = orders.filter(o => o.id !== orderId);
    saveLocalItems(LOCAL_ORDERS_KEY, filtered);
    window.dispatchEvent(new CustomEvent("aura_orders_changed", { detail: { action: "delete", orderId } }));
    return true;
  }

  // ==================== ANNOUNCEMENT TICKER SETTINGS ====================
  static async getAnnouncement() {
    const LOCAL_ANNOUNCEMENT_KEY = "aura_announcement_cache";
    let localData = null;
    try {
      const raw = localStorage.getItem(LOCAL_ANNOUNCEMENT_KEY);
      if (raw) localData = JSON.parse(raw);
    } catch (e) { }

    if (isFirebaseConnected && db) {
      try {
        const docRef = doc(db, "settings", "announcement");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const cloudData = snap.data();
          saveLocalItems(LOCAL_ANNOUNCEMENT_KEY, cloudData);
          return cloudData;
        }
      } catch (e) {
        console.warn("Firestore getAnnouncement fallback to local:", e);
      }
    }

    return localData || {
      enabled: false,
      badge: "FLASH OFFER",
      text: "Use code AURA10 for 10% OFF • 🚀 Free Same-Day Express Dispatch in Pakistan",
      gradient: "linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f97316 100%)",
      updatedAt: new Date().toISOString()
    };
  }

  static async updateAnnouncement(announcementData) {
    const LOCAL_ANNOUNCEMENT_KEY = "aura_announcement_cache";
    const payload = {
      enabled: Boolean(announcementData.enabled),
      badge: announcementData.badge || "",
      text: announcementData.text || "",
      gradient: announcementData.gradient || "linear-gradient(90deg, #06b6d4 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f97316 100%)",
      updatedAt: new Date().toISOString()
    };

    if (isFirebaseConnected && db) {
      try {
        await setDoc(doc(db, "settings", "announcement"), payload, { merge: true });
        // Also sync to admin/announcement backup
        await setDoc(doc(db, "admin", "announcement"), payload, { merge: true }).catch(() => { });
        console.log("✅ Announcement saved to Firestore settings/announcement");
      } catch (e) {
        console.warn("Firestore updateAnnouncement error, saved locally:", e);
      }
    }

    try {
      localStorage.setItem(LOCAL_ANNOUNCEMENT_KEY, JSON.stringify(payload));
    } catch (e) { }

    window.dispatchEvent(new CustomEvent("aura_announcement_changed", { detail: payload }));
    return payload;
  }
}

DBService.init();
