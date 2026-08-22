// shared/services/cloudinary-service.js
export class CloudinaryService {
  static CLOUD_NAME = "nlfppv99";
  static UPLOAD_PRESET = "e-commerce-images";
  static FOLDER = "nextgen-store/products";
  static UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CloudinaryService.CLOUD_NAME}/image/upload`;

  /**
   * Upload a single image (File, Blob, or base64 data URL) to Cloudinary.
   * @param {File|Blob|string} fileOrData
   * @returns {Promise<string>} The secure HTTPS CDN URL of the uploaded image
   */
  static async uploadImage(fileOrData) {
    if (typeof fileOrData === "string" && (fileOrData.startsWith("http://") || fileOrData.startsWith("https://"))) {
      // Already an online URL, no need to upload
      return fileOrData;
    }

    const formData = new FormData();
    formData.append("file", fileOrData);
    formData.append("upload_preset", this.UPLOAD_PRESET);
    formData.append("folder", this.FOLDER);

    const response = await fetch(this.UPLOAD_URL, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `Cloudinary upload failed with status ${response.status}`;
      console.error("Cloudinary upload error:", msg, errData);
      throw new Error(msg);
    }

    const data = await response.json();
    console.log("✅ Image uploaded to Cloudinary successfully:", data.secure_url);
    return data.secure_url;
  }

  /**
   * Upload multiple images in sequence or parallel and return an array of secure URLs.
   * @param {Array<File|Blob|string>} items
   * @param {Function} [onProgress] Callback (current, total)
   * @returns {Promise<string[]>}
   */
  static async uploadMultipleImages(items, onProgress) {
    const urls = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item === "string" && (item.startsWith("http://") || item.startsWith("https://"))) {
        urls.push(item);
      } else {
        if (onProgress) onProgress(i + 1, items.length);
        const uploadedUrl = await this.uploadImage(item);
        urls.push(uploadedUrl);
      }
    }
    return urls;
  }

  /**
   * Utility to apply Cloudinary transformations like auto-format and auto-quality.
   * @param {string} url 
   * @param {string} transforms e.g. "f_auto,q_auto,w_800"
   * @returns {string}
   */
  static getOptimizedUrl(url, transforms = "f_auto,q_auto") {
    if (!url || !url.includes("cloudinary.com")) return url;
    return url.replace("/upload/", `/upload/${transforms}/`);
  }
}
