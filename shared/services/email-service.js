// shared/services/email-service.js
import { db, isFirebaseConnected, doc, setDoc, addDoc, collection } from "../config/firebase-config.js";

function formatPKR(amount) {
  return "Rs. " + Number(amount || 0).toLocaleString("en-PK");
}

export class EmailService {
  /**
   * Beautiful Unicode formatted text email for Gmail and standard mail clients
   */
  static generateStatusEmailPlainText(order, newStatus) {
    const itemsList = (order.items || []).map(i => `  • ${i.quantity}x ${i.title.padEnd(28, ' ')} ${formatPKR(i.price * i.quantity)}`).join("\n");
    
    return `╔═══════════════════════════════════════════════════════╗\n` +
      `║                  NEXTGEN STORE                        ║\n` +
      `║          Official Order Status Notification           ║\n` +
      `╚═══════════════════════════════════════════════════════╝\n\n` +
      `Dear ${order.customer?.name || 'Customer'},\n\n` +
      `Great news! Your order from NextGen Store has a new update:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `   CURRENT STATUS: [ ${newStatus.toUpperCase()} ]\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📦 ORDER SUMMARY\n` +
      `─────────────────────────────────────────────────────────\n` +
      `Order Number    : #${order.id}\n` +
      `Date Placed     : ${new Date(order.createdAt).toLocaleDateString()}\n` +
      `Payment Method  : ${order.paymentMethod || 'Cash on Delivery (COD)'}\n\n` +
      `🛍️ ITEMS PURCHASED:\n` +
      `${itemsList}\n\n` +
      `─────────────────────────────────────────────────────────\n` +
      `Subtotal Amount : ${formatPKR(order.subtotal || 0)}\n` +
      `Delivery Charge : ${order.shipping === 0 ? 'FREE DELIVERY' : formatPKR(order.shipping || 0)}\n` +
      (order.discount > 0 ? `Promo Discount  : -${formatPKR(order.discount)}\n` : '') +
      `GRAND TOTAL     : ${formatPKR(order.total || 0)}\n` +
      `─────────────────────────────────────────────────────────\n\n` +
      `📍 DELIVERY ADDRESS\n` +
      `─────────────────────────────────────────────────────────\n` +
      `Recipient Name  : ${order.customer?.name || 'Customer'}\n` +
      `Shipping Address: ${order.customer?.address || 'Standard Address'}\n` +
      `Contact Phone   : ${order.customer?.phone || 'N/A'}\n\n` +
      `═════════════════════════════════════════════════════════\n` +
      `Need help? Reply directly to this email or visit our store.\n` +
      `NextGen Store — Pakistan's Premier Online Store\n` +
      `═════════════════════════════════════════════════════════`;
  }

  /**
   * Generates a breathtaking, visual HTML email template with modern dark gradients,
   * progress timeline, item thumbnails, and styled invoice card.
   */
  static generateStatusEmailHTML(order, newStatus) {
    const statusConfig = {
      Pending: { color: "#f59e0b", icon: "⏳", text: "Order Received & Pending Verification", step: 1 },
      Processing: { color: "#3b82f6", icon: "⚙️", text: "Order is Being Packed & Prepared", step: 2 },
      Shipped: { color: "#8b5cf6", icon: "🚚", text: "Dispatched & On the Way with Courier", step: 3 },
      Delivered: { color: "#10b981", icon: "✅", text: "Package Successfully Delivered", step: 4 },
      Cancelled: { color: "#ef4444", icon: "❌", text: "Order Has Been Cancelled", step: 0 }
    };

    const cfg = statusConfig[newStatus] || { color: "#6366f1", icon: "📦", text: `Order status updated to ${newStatus}`, step: 1 };
    const step = cfg.step;

    const itemsHTML = (order.items || []).map(item => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px 0; width: 50px;">
          ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 44px; height: 44px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; display: block;">` : ''}
        </td>
        <td style="padding: 12px 10px; font-size: 13px; color: #1e293b; vertical-align: middle;">
          <strong style="color: #0f172a; font-size: 13px;">${item.title}</strong><br>
          <span style="font-size: 11px; color: #64748b; font-weight: 500;">Qty: ${item.quantity} × ${formatPKR(item.price)}</span>
        </td>
        <td style="padding: 12px 0; font-size: 13px; color: #0f172a; text-align: right; font-weight: 700; vertical-align: middle;">
          ${formatPKR(item.price * item.quantity)}
        </td>
      </tr>
    `).join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NextGen Store - Order Status #${order.id}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          
          <!-- Top Header with Neon Gradient Brand -->
          <tr>
            <td style="background: linear-gradient(135deg, #090d16 0%, #1e1b4b 60%, #31104b 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #6366f1;">
              <div style="display: inline-block; padding: 5px 14px; background: rgba(99, 102, 241, 0.25); border: 1px solid rgba(99, 102, 241, 0.5); border-radius: 30px; color: #c7d2fe; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;">
                Official Order Tracking
              </div>
              <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; text-shadow: 0 2px 10px rgba(99,102,241,0.5);">
                ✨ NEXTGEN STORE
              </h1>
              <p style="color: #94a3b8; font-size: 12px; margin: 6px 0 0 0; letter-spacing: 0.06em; text-transform: uppercase;">
                Pakistan's Premier Online Store
              </p>
            </td>
          </tr>

          <!-- Status Highlight Card -->
          <tr>
            <td style="padding: 28px 24px 16px 24px; text-align: center; background: #fafafa;">
              <div style="display: inline-block; padding: 8px 22px; background: ${cfg.color}18; border: 1.5px solid ${cfg.color}; border-radius: 50px; color: ${cfg.color}; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
                ${cfg.icon} STATUS: ${newStatus}
              </div>
              <h2 style="margin: 0 0 6px 0; font-size: 22px; color: #0f172a; font-weight: 800;">
                Order #${order.id}
              </h2>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                Dear <strong>${order.customer?.name || 'Valued Customer'}</strong>,<br>
                ${cfg.text}
              </p>

              <!-- Progress Steps Timeline -->
              <div style="margin: 20px auto 10px auto; max-width: 460px; display: flex; justify-content: space-between; align-items: center;">
                <div style="text-align: center; flex: 1;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: ${step >= 1 ? '#6366f1' : '#e2e8f0'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto; font-size: 12px; font-weight: 700;">1</div>
                  <span style="font-size: 10px; font-weight: 700; color: ${step >= 1 ? '#0f172a' : '#94a3b8'};">Received</span>
                </div>
                <div style="height: 3px; flex: 1; background: ${step >= 2 ? '#6366f1' : '#e2e8f0'}; margin: -14px 2px 0 2px;"></div>
                <div style="text-align: center; flex: 1;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: ${step >= 2 ? '#6366f1' : '#e2e8f0'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto; font-size: 12px; font-weight: 700;">2</div>
                  <span style="font-size: 10px; font-weight: 700; color: ${step >= 2 ? '#0f172a' : '#94a3b8'};">Packed</span>
                </div>
                <div style="height: 3px; flex: 1; background: ${step >= 3 ? '#6366f1' : '#e2e8f0'}; margin: -14px 2px 0 2px;"></div>
                <div style="text-align: center; flex: 1;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: ${step >= 3 ? '#6366f1' : '#e2e8f0'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto; font-size: 12px; font-weight: 700;">3</div>
                  <span style="font-size: 10px; font-weight: 700; color: ${step >= 3 ? '#0f172a' : '#94a3b8'};">Shipped</span>
                </div>
                <div style="height: 3px; flex: 1; background: ${step >= 4 ? '#10b981' : '#e2e8f0'}; margin: -14px 2px 0 2px;"></div>
                <div style="text-align: center; flex: 1;">
                  <div style="width: 28px; height: 28px; border-radius: 50%; background: ${step >= 4 ? '#10b981' : '#e2e8f0'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 4px auto; font-size: 12px; font-weight: 700;">4</div>
                  <span style="font-size: 10px; font-weight: 700; color: ${step >= 4 ? '#10b981' : '#94a3b8'};">Delivered</span>
                </div>
              </div>
            </td>
          </tr>

          <!-- Order Items & Invoice Card -->
          <tr>
            <td style="padding: 16px 24px 24px 24px;">
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; margin-bottom: 12px;">
                  <h3 style="margin: 0; font-size: 13px; color: #0f172a; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Purchased Items</h3>
                  <span style="font-size: 11px; background: #e0e7ff; color: #4338ca; font-weight: 700; padding: 2px 8px; border-radius: 4px;">PKR Official</span>
                </div>
                
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  ${itemsHTML}
                </table>

                <!-- Pricing Calculation Table -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px; border-top: 2px dashed #cbd5e1; padding-top: 12px;">
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Subtotal:</td>
                    <td style="font-size: 13px; color: #0f172a; text-align: right; font-weight: 600;">${formatPKR(order.subtotal || 0)}</td>
                  </tr>
                  <tr>
                    <td style="font-size: 13px; color: #64748b; padding: 3px 0;">Delivery Fee:</td>
                    <td style="font-size: 13px; color: #10b981; text-align: right; font-weight: 700;">${order.shipping === 0 ? 'FREE' : formatPKR(order.shipping || 0)}</td>
                  </tr>
                  ${order.discount > 0 ? `
                  <tr>
                    <td style="font-size: 13px; color: #6366f1; padding: 3px 0;">Discount Coupon:</td>
                    <td style="font-size: 13px; color: #6366f1; text-align: right; font-weight: 700;">-${formatPKR(order.discount)}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="font-size: 15px; font-weight: 800; color: #0f172a; padding-top: 10px; border-top: 1px solid #f1f5f9;">Grand Total:</td>
                    <td style="font-size: 19px; font-weight: 900; color: #6366f1; text-align: right; padding-top: 10px; border-top: 1px solid #f1f5f9; font-family: monospace;">${formatPKR(order.total || 0)}</td>
                  </tr>
                </table>
              </div>

              <!-- Shipping & Customer Info Box -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-top: 14px; font-size: 12px; color: #475569; line-height: 1.6;">
                <div style="font-weight: 800; color: #0f172a; font-size: 13px; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
                  <span>📍</span> Delivery Information
                </div>
                <div><strong>Customer:</strong> ${order.customer?.name || 'Customer'}</div>
                <div><strong>Address:</strong> ${order.customer?.address || 'Standard Delivery Address'}</div>
                <div><strong>Phone:</strong> ${order.customer?.phone || 'N/A'}</div>
                <div><strong>Payment:</strong> <span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #1e293b;">${order.paymentMethod || 'Cash on Delivery (COD)'}</span></div>
              </div>
            </td>
          </tr>

          <!-- Modern Dark Footer -->
          <tr>
            <td style="background: #090d16; padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #1e293b;">
              <strong style="color: #ffffff; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase;">NEXTGEN STORE</strong>
              <p style="margin: 6px 0 4px 0; color: #cbd5e1; font-size: 12px;">Need help? Reply to this email directly or contact our 24/7 support.</p>
              <p style="margin: 0; font-size: 11px; color: #64748b;">© 2026 NextGen Store. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Generates direct Web Gmail Compose URL with pre-filled content
   */
  static getGmailWebComposeUrl(order, newStatus) {
    const subject = encodeURIComponent(`[NextGen Store] Order #${order.id} Status Update: ${newStatus}`);
    const body = encodeURIComponent(this.generateStatusEmailPlainText(order, newStatus));
    const to = encodeURIComponent(order.customer?.email || '');
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
  }

  /**
   * Helper to open pre-filled mail client
   */
  static getMailtoUrl(order, newStatus) {
    const subject = encodeURIComponent(`[NextGen Store] Order #${order.id} Status Update: ${newStatus}`);
    const body = encodeURIComponent(this.generateStatusEmailPlainText(order, newStatus));
    return `mailto:${order.customer?.email}?subject=${subject}&body=${body}`;
  }

  /**
   * Sends or queues the email notification to customer
   */
  static async sendOrderStatusEmail(order, newStatus) {
    if (!order || !order.customer?.email) {
      console.warn("Cannot send email: Order customer email missing.");
      return false;
    }

    const emailSubject = `[NextGen Store] Order #${order.id} Status Update: ${newStatus}`;
    const emailHTML = this.generateStatusEmailHTML(order, newStatus);
    const emailPlainText = this.generateStatusEmailPlainText(order, newStatus);
    const customerEmail = order.customer.email;

    console.log(`📧 [NextGen Store Email Service] Dispatching status update email to: ${customerEmail}`);

    // 1. Log to Cloud Firestore `mail` collection
    if (isFirebaseConnected && db) {
      try {
        const mailPayload = {
          to: customerEmail,
          fromName: "NextGen Store",
          message: {
            subject: emailSubject,
            html: emailHTML,
            text: emailPlainText
          },
          orderId: order.id,
          status: newStatus,
          sentAt: new Date().toISOString()
        };

        await addDoc(collection(db, "mail"), mailPayload);

        if (order.customer.userId) {
          await addDoc(collection(db, "users", order.customer.userId, "notifications"), {
            type: "order_status",
            orderId: order.id,
            status: newStatus,
            title: `NextGen Store: Order #${order.id} is ${newStatus}`,
            message: `Your order #${order.id} from NextGen Store is now marked as ${newStatus}. Total: ${formatPKR(order.total)}`,
            createdAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.warn("Firestore mail queue write error:", e);
      }
    }

    // 2. Dispatch Custom Event so Admin UI opens the Live Email Dispatch Modal
    window.dispatchEvent(new CustomEvent("aura_email_dispatched", {
      detail: {
        to: customerEmail,
        customerName: order.customer.name,
        orderId: order.id,
        status: newStatus,
        subject: emailSubject,
        html: emailHTML,
        plainText: emailPlainText,
        gmailWebUrl: this.getGmailWebComposeUrl(order, newStatus),
        mailtoUrl: this.getMailtoUrl(order, newStatus),
        order
      }
    }));

    return true;
  }
}
