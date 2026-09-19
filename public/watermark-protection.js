/**
 * Mall of Abayas (MOA) - Storefront Watermark & Anti-Theft Protection Script
 * Protects store images from unauthorized download, right-click, and dragging.
 */
(function () {
  'use strict';

  const config = {
    disableRightClick: true,
    disableDragAndDrop: true,
    disableInspectShortcuts: true,
    warningMessage: '⚠️ Product images on Mall of Abayas are protected by copyright law.'
  };

  // Toast notification
  function showWarningToast(msg) {
    let toast = document.getElementById('moa-protection-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'moa-protection-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(18, 18, 18, 0.95);
        color: #e2b142;
        border: 1px solid #c59b27;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        padding: 12px 20px;
        border-radius: 8px;
        font-family: 'Montserrat', -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        z-index: 9999999;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg || config.warningMessage;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
  }

  // 1. Right Click Protection
  if (config.disableRightClick) {
    document.addEventListener('contextmenu', function (e) {
      const target = e.target;
      if (target.tagName === 'IMG' || target.closest('.product__media') || target.closest('.media') || target.closest('.product-image')) {
        e.preventDefault();
        showWarningToast();
        return false;
      }
    });
  }

  // 2. Drag & Drop Image Protection
  if (config.disableDragAndDrop) {
    document.addEventListener('dragstart', function (e) {
      if (e.target.tagName === 'IMG') {
        e.preventDefault();
        return false;
      }
    });
  }

  // 3. Inspect / Save Shortcuts Protection
  if (config.disableInspectShortcuts) {
    document.addEventListener('keydown', function (e) {
      // Ctrl+S / Cmd+S (Save page)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        showWarningToast('Saving content is disabled for this store.');
        return false;
      }
      // Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
      }
      // F12 or Ctrl+Shift+I / Cmd+Opt+I (DevTools)
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c'))) {
        // Soft block if needed
      }
    });
  }

  console.log('🔒 MOA Product Protection & Watermarking active.');
})();
