/**
 * Shared Collection Page Utilities
 * Used by: critter-collection, tree-collection, fish-collection, music/collection, bike-collection
 * FRONTEND_PATTERNS.md - Discovery/Collection pages
 */

(function (window) {
  'use strict';

  const COLLECTION_UTILS = {
    /**
     * Show a toast notification. Delegates to shared toast.js when available.
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - 'success' | 'error' | 'info'
     * @param {number} durationMs - Auto-remove after ms (default 4000)
     */
    showToast(title, message, type = 'info', durationMs = 4000) {
      if (typeof window.showToast === 'function') {
        window.showToast(title, message, type, durationMs);
        return;
      }
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'collection-toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:400px;';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `collection-toast toast ${type}`;
      toast.innerHTML = `<strong>${title}</strong><br>${message}`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, durationMs);
    },

    /**
     * Resolve image URL for poster generation (proxy external URLs).
     * @param {string} url - Image URL
     * @returns {string} Resolved URL
     */
    resolvePosterImageUrl(url) {
      if (!url) return url;
      if (url.startsWith('data:') || url.startsWith('blob:')) return url;
      if (url.startsWith('/') || url.startsWith(window.location.origin)) return url;
      return `/api/poster-generator/proxy-image?url=${encodeURIComponent(url)}`;
    },

    /**
     * Wait for all images in a container to load.
     * @param {HTMLElement} container - Element containing img elements
     * @returns {Promise<void>}
     */
    waitForPosterImages(container) {
      if (!container) return Promise.resolve();
      const images = Array.from(container.querySelectorAll('img'));
      return Promise.all(images.map(img =>
        img.complete ? Promise.resolve() : new Promise(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
      ));
    },

    /**
     * Request device location (geolocation).
     * @returns {Promise<{lat:number,lng:number}|null>}
     */
    requestDeviceLocation() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          resolve(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
      });
    },

    /**
     * Build address label from form fields.
     * @param {Object} ids - { street, city, state, zip }
     * @returns {string}
     */
    buildAddressLabel(ids = {}) {
      const street = (document.getElementById(ids.street || 'editAddressStreet')?.value?.trim() || '').trim();
      const city = (document.getElementById(ids.city || 'editAddressCity')?.value?.trim() || '').trim();
      const state = (document.getElementById(ids.state || 'editAddressState')?.value?.trim() || '').trim();
      const zip = (document.getElementById(ids.zip || 'editAddressZip')?.value?.trim() || '').trim();
      return [street, city, state, zip].filter(Boolean).join(', ');
    }
  };

  window.collectionUtils = COLLECTION_UTILS;

  // Backward compatibility: expose showToast globally if pages expect it
  window.showCollectionToast = COLLECTION_UTILS.showToast;
})(window);
