/**
 * Shopify App: Product Image Watermark & Protection
 * Interactive Rule Editor, Live Preview Canvas & Batch Watermarking Engine
 */
document.addEventListener('DOMContentLoaded', () => {
  // Current rule state
  let currentRule = {
    id: '251',
    name: 'Logo',
    status: 'active',
    hasTextWatermark: false,
    textConfig: {
      text: 'MALL OF ABAYAS',
      fontSize: 28,
      fontColor: '#ffffff',
      fontFamily: 'Montserrat',
      opacity: 80,
      position: 'center',
      rotation: -15
    },
    hasImageWatermark: true,
    imageConfig: {
      imageUrl: '/watermark-logo.svg',
      layout: 'single',
      position: 'center-right',
      opacity: 100,
      sizePx: 500,
      sizeUnit: 'px',
      rotation: 0
    },
    appliesTo: {
      products: 'all',
      images: 'all',
      skipAlreadyWatermarked: true,
      applyToNewImages: true
    }
  };

  let productsList = [];
  let selectedProduct = null;
  let selectedImageIndex = 0;

  // DOM Elements
  const ruleNameInput = document.getElementById('rule-name');
  const ruleStatusSelect = document.getElementById('rule-status');
  const textWatermarkToggle = document.getElementById('toggle-text-watermark');
  const textWatermarkCard = document.getElementById('text-watermark-controls');
  const watermarkTextInput = document.getElementById('watermark-text');
  const watermarkTextOpacityInput = document.getElementById('text-opacity');
  const watermarkTextRotationInput = document.getElementById('text-rotation');

  const imageWatermarkToggle = document.getElementById('toggle-image-watermark');
  const imageWatermarkCard = document.getElementById('image-watermark-controls');
  const logoThumbImg = document.getElementById('logo-thumb-img');
  const fileUploadInput = document.getElementById('logo-file-input');
  const replaceLogoBtn = document.getElementById('btn-replace-logo');
  const removeLogoBtn = document.getElementById('btn-remove-logo');
  
  const layoutSingleRadio = document.getElementById('layout-single');
  const layoutTileRadio = document.getElementById('layout-tile');
  const positionSelect = document.getElementById('image-position-select');
  const positionGroup = document.getElementById('single-position-group');
  
  const opacityInput = document.getElementById('image-opacity');
  const sizeInput = document.getElementById('image-size');
  const moreOptionsToggle = document.getElementById('more-options-toggle');
  const moreOptionsContent = document.getElementById('more-options-content');
  const imageRotationInput = document.getElementById('image-rotation');

  const appliesProductsSelect = document.getElementById('applies-products');
  const appliesImagesSelect = document.getElementById('applies-images');
  const skipWatermarkedCheck = document.getElementById('skip-watermarked');
  const applyNewImagesCheck = document.getElementById('apply-new-images');

  // Preview elements
  const previewProductSelect = document.getElementById('preview-product-select');
  const previewImageSelect = document.getElementById('preview-image-select');
  const previewContainer = document.getElementById('preview-canvas-container');
  const baseImgEl = document.getElementById('preview-base-img');
  const watermarkLayer = document.getElementById('preview-watermark-layer');
  const btnViewLarger = document.getElementById('btn-view-larger');
  const btnDownload = document.getElementById('btn-download-preview');
  const btnSaveRule = document.getElementById('btn-save-rule');
  const btnDeleteRule = document.getElementById('btn-delete-rule');
  const btnApplyRule = document.getElementById('btn-apply-rule');

  // Modal elements
  const modalBackdrop = document.getElementById('preview-modal');
  const modalImg = document.getElementById('modal-preview-img');
  const modalClose = document.getElementById('modal-close-btn');

  // Initialize Data
  async function init() {
    setupEventListeners();
    await fetchProducts();
    await loadRule('251');
  }

  // Fetch store products for preview
  async function fetchProducts() {
    try {
      const res = await fetch('/api/watermark/products');
      const data = await res.json();
      if (data.success) {
        productsList = data.products;
        populateProductDropdown();
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  function populateProductDropdown() {
    previewProductSelect.innerHTML = '';
    productsList.forEach((prod, index) => {
      const opt = document.createElement('option');
      opt.value = prod.id;
      opt.textContent = prod.title;
      previewProductSelect.appendChild(opt);
    });

    if (productsList.length > 0) {
      selectedProduct = productsList[0];
      previewProductSelect.value = selectedProduct.id;
      populateImageDropdown();
    }
  }

  function populateImageDropdown() {
    if (!selectedProduct) return;
    previewImageSelect.innerHTML = '';
    selectedProduct.images.forEach((img, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `Image ${idx + 1}`;
      previewImageSelect.appendChild(opt);
    });

    selectedImageIndex = 0;
    previewImageSelect.value = 0;
    updateBaseImage();
  }

  function updateBaseImage() {
    if (!selectedProduct || !selectedProduct.images[selectedImageIndex]) return;
    const currentImg = selectedProduct.images[selectedImageIndex];
    baseImgEl.src = currentImg.url;
    baseImgEl.onload = () => {
      renderLivePreview();
    };
  }

  // Load Rule from server
  async function loadRule(id) {
    try {
      const res = await fetch(`/api/watermark/rules/${id}`);
      const data = await res.json();
      if (data.success && data.rule) {
        currentRule = data.rule;
        populateFormFromRule();
        renderLivePreview();
      }
    } catch (err) {
      console.warn('Could not load rule from server, using defaults:', err);
      populateFormFromRule();
      renderLivePreview();
    }
  }

  function populateFormFromRule() {
    ruleNameInput.value = currentRule.name;
    document.getElementById('rule-main-title').textContent = currentRule.name;
    ruleStatusSelect.value = currentRule.status;

    // Text watermark
    textWatermarkToggle.checked = currentRule.hasTextWatermark;
    textWatermarkCard.style.display = currentRule.hasTextWatermark ? 'block' : 'none';
    if (currentRule.textConfig) {
      watermarkTextInput.value = currentRule.textConfig.text;
      watermarkTextOpacityInput.value = currentRule.textConfig.opacity;
      watermarkTextRotationInput.value = currentRule.textConfig.rotation || 0;
    }

    // Image watermark
    imageWatermarkToggle.checked = currentRule.hasImageWatermark;
    imageWatermarkCard.style.display = currentRule.hasImageWatermark ? 'block' : 'none';
    if (currentRule.imageConfig) {
      logoThumbImg.src = currentRule.imageConfig.imageUrl;
      if (currentRule.imageConfig.layout === 'tile') {
        layoutTileRadio.checked = true;
        positionGroup.style.display = 'none';
      } else {
        layoutSingleRadio.checked = true;
        positionGroup.style.display = 'block';
      }
      positionSelect.value = currentRule.imageConfig.position;
      opacityInput.value = currentRule.imageConfig.opacity;
      sizeInput.value = currentRule.imageConfig.sizePx;
      imageRotationInput.value = currentRule.imageConfig.rotation || 0;
    }

    // Applies to
    appliesProductsSelect.value = currentRule.appliesTo.products;
    appliesImagesSelect.value = currentRule.appliesTo.images;
    skipWatermarkedCheck.checked = currentRule.appliesTo.skipAlreadyWatermarked;
    applyNewImagesCheck.checked = currentRule.appliesTo.applyToNewImages;
  }

  // Render Live Preview with Canvas & Overlay
  function renderLivePreview() {
    watermarkLayer.innerHTML = '';

    const containerWidth = baseImgEl.clientWidth || 300;
    const containerHeight = baseImgEl.clientHeight || 380;

    // 1. Text Watermark Preview
    if (currentRule.hasTextWatermark && currentRule.textConfig && currentRule.textConfig.text) {
      const textEl = document.createElement('div');
      textEl.className = 'preview-watermark-text';
      textEl.textContent = currentRule.textConfig.text;
      textEl.style.opacity = (currentRule.textConfig.opacity / 100).toString();
      textEl.style.transform = `rotate(${currentRule.textConfig.rotation || 0}deg)`;
      textEl.style.fontSize = `${Math.max(14, Math.round(containerWidth * 0.07))}px`;

      // Center it
      textEl.style.left = '50%';
      textEl.style.top = '50%';
      textEl.style.transform = `translate(-50%, -50%) rotate(${currentRule.textConfig.rotation || 0}deg)`;

      watermarkLayer.appendChild(textEl);
    }

    // 2. Image Watermark Preview
    if (currentRule.hasImageWatermark && currentRule.imageConfig && currentRule.imageConfig.imageUrl) {
      const { layout, position, opacity, sizePx, rotation } = currentRule.imageConfig;
      const logoUrl = currentRule.imageConfig.imageUrl;

      // Scale logo size relative to preview container
      // If full res size is 500px on a 1000px wide image, it should take ~50% of the preview width
      const scaleRatio = containerWidth / 1000;
      const displayLogoWidth = Math.max(40, Math.min(containerWidth * 0.8, Math.round((sizePx || 400) * scaleRatio)));

      if (layout === 'tile') {
        const cols = 3;
        const rows = 3;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const tileImg = document.createElement('img');
            tileImg.src = logoUrl;
            tileImg.className = 'preview-watermark-logo';
            tileImg.style.width = `${Math.round(displayLogoWidth * 0.6)}px`;
            tileImg.style.opacity = (opacity / 100).toString();
            tileImg.style.left = `${c * (containerWidth / cols) + 15}px`;
            tileImg.style.top = `${r * (containerHeight / rows) + 15}px`;
            tileImg.style.transform = `rotate(${rotation || -15}deg)`;
            watermarkLayer.appendChild(tileImg);
          }
        }
      } else {
        const logoImg = document.createElement('img');
        logoImg.src = logoUrl;
        logoImg.className = 'preview-watermark-logo';
        logoImg.style.width = `${displayLogoWidth}px`;
        logoImg.style.opacity = (opacity / 100).toString();
        logoImg.style.transform = `rotate(${rotation || 0}deg)`;

        const pad = 14;
        switch (position) {
          case 'top-left':
            logoImg.style.top = `${pad}px`;
            logoImg.style.left = `${pad}px`;
            break;
          case 'top-center':
            logoImg.style.top = `${pad}px`;
            logoImg.style.left = '50%';
            logoImg.style.transform = `translateX(-50%) rotate(${rotation || 0}deg)`;
            break;
          case 'top-right':
            logoImg.style.top = `${pad}px`;
            logoImg.style.right = `${pad}px`;
            break;
          case 'center-left':
            logoImg.style.top = '50%';
            logoImg.style.left = `${pad}px`;
            logoImg.style.transform = `translateY(-50%) rotate(${rotation || 0}deg)`;
            break;
          case 'center':
            logoImg.style.top = '50%';
            logoImg.style.left = '50%';
            logoImg.style.transform = `translate(-50%, -50%) rotate(${rotation || 0}deg)`;
            break;
          case 'center-right':
            logoImg.style.top = '50%';
            logoImg.style.right = `${pad}px`;
            logoImg.style.transform = `translateY(-50%) rotate(${rotation || 0}deg)`;
            break;
          case 'bottom-left':
            logoImg.style.bottom = `${pad}px`;
            logoImg.style.left = `${pad}px`;
            break;
          case 'bottom-center':
            logoImg.style.bottom = `${pad}px`;
            logoImg.style.left = '50%';
            logoImg.style.transform = `translateX(-50%) rotate(${rotation || 0}deg)`;
            break;
          case 'bottom-right':
          default:
            logoImg.style.bottom = `${pad}px`;
            logoImg.style.right = `${pad}px`;
            break;
        }

        watermarkLayer.appendChild(logoImg);
      }
    }
  }

  // Generate High-Res Composited Canvas for Modal / Download
  function generateHighResCanvas() {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const base = new Image();
      base.crossOrigin = 'anonymous';
      base.src = baseImgEl.src;

      base.onload = () => {
        canvas.width = base.naturalWidth || 1000;
        canvas.height = base.naturalHeight || 1500;

        // Draw base image
        ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

        // Draw text watermark
        if (currentRule.hasTextWatermark && currentRule.textConfig && currentRule.textConfig.text) {
          ctx.save();
          ctx.globalAlpha = currentRule.textConfig.opacity / 100;
          ctx.font = `bold ${Math.round(canvas.width * 0.05)}px Montserrat, sans-serif`;
          ctx.fillStyle = currentRule.textConfig.fontColor || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 8;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(((currentRule.textConfig.rotation || 0) * Math.PI) / 180);
          ctx.fillText(currentRule.textConfig.text, 0, 0);
          ctx.restore();
        }

        // Draw image watermark
        if (currentRule.hasImageWatermark && currentRule.imageConfig && currentRule.imageConfig.imageUrl) {
          const wm = new Image();
          wm.crossOrigin = 'anonymous';
          wm.src = currentRule.imageConfig.imageUrl;

          wm.onload = () => {
            const wmWidth = Math.min(currentRule.imageConfig.sizePx || 500, Math.round(canvas.width * 0.45));
            const aspect = wm.naturalHeight / (wm.naturalWidth || 1);
            const wmHeight = Math.round(wmWidth * aspect);

            ctx.save();
            ctx.globalAlpha = currentRule.imageConfig.opacity / 100;

            const padding = 40;
            let x = padding;
            let y = padding;

            if (currentRule.imageConfig.layout === 'tile') {
              const cols = Math.ceil(canvas.width / (wmWidth + 80));
              const rows = Math.ceil(canvas.height / (wmHeight + 80));
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  ctx.drawImage(wm, c * (wmWidth + 80) + 40, r * (wmHeight + 80) + 40, wmWidth, wmHeight);
                }
              }
            } else {
              switch (currentRule.imageConfig.position) {
                case 'top-left':
                  x = padding; y = padding; break;
                case 'top-center':
                  x = (canvas.width - wmWidth) / 2; y = padding; break;
                case 'top-right':
                  x = canvas.width - wmWidth - padding; y = padding; break;
                case 'center-left':
                  x = padding; y = (canvas.height - wmHeight) / 2; break;
                case 'center':
                  x = (canvas.width - wmWidth) / 2; y = (canvas.height - wmHeight) / 2; break;
                case 'center-right':
                  x = canvas.width - wmWidth - padding; y = (canvas.height - wmHeight) / 2; break;
                case 'bottom-left':
                  x = padding; y = canvas.height - wmHeight - padding; break;
                case 'bottom-center':
                  x = (canvas.width - wmWidth) / 2; y = canvas.height - wmHeight - padding; break;
                case 'bottom-right':
                default:
                  x = canvas.width - wmWidth - padding; y = canvas.height - wmHeight - padding; break;
              }
              ctx.drawImage(wm, x, y, wmWidth, wmHeight);
            }
            ctx.restore();
            resolve(canvas);
          };

          wm.onerror = () => resolve(canvas);
        } else {
          resolve(canvas);
        }
      };
      base.onerror = () => resolve(canvas);
    });
  }

  // Event Listeners setup
  function setupEventListeners() {
    // Rule details
    ruleNameInput.addEventListener('input', (e) => {
      currentRule.name = e.target.value;
      document.getElementById('rule-main-title').textContent = e.target.value || 'Untitled Rule';
    });

    ruleStatusSelect.addEventListener('change', (e) => {
      currentRule.status = e.target.value;
    });

    // Text watermark toggles
    textWatermarkToggle.addEventListener('change', (e) => {
      currentRule.hasTextWatermark = e.target.checked;
      textWatermarkCard.style.display = e.target.checked ? 'block' : 'none';
      renderLivePreview();
    });

    watermarkTextInput.addEventListener('input', (e) => {
      if (!currentRule.textConfig) currentRule.textConfig = {};
      currentRule.textConfig.text = e.target.value;
      renderLivePreview();
    });

    watermarkTextOpacityInput.addEventListener('input', (e) => {
      if (!currentRule.textConfig) currentRule.textConfig = {};
      currentRule.textConfig.opacity = parseInt(e.target.value) || 100;
      renderLivePreview();
    });

    watermarkTextRotationInput.addEventListener('input', (e) => {
      if (!currentRule.textConfig) currentRule.textConfig = {};
      currentRule.textConfig.rotation = parseInt(e.target.value) || 0;
      renderLivePreview();
    });

    // Image watermark toggles
    imageWatermarkToggle.addEventListener('change', (e) => {
      currentRule.hasImageWatermark = e.target.checked;
      imageWatermarkCard.style.display = e.target.checked ? 'block' : 'none';
      renderLivePreview();
    });

    replaceLogoBtn.addEventListener('click', () => {
      fileUploadInput.click();
    });

    fileUploadInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('logo', file);

        try {
          showToast('Uploading watermark logo...');
          const res = await fetch('/api/watermark/upload-logo', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.success && data.url) {
            currentRule.imageConfig.imageUrl = data.url;
            logoThumbImg.src = data.url;
            renderLivePreview();
            showToast('Watermark logo updated!');
          }
        } catch (err) {
          console.error('Failed to upload logo:', err);
          showToast('Error uploading logo', true);
        }
      }
    });

    removeLogoBtn.addEventListener('click', () => {
      currentRule.hasImageWatermark = false;
      imageWatermarkToggle.checked = false;
      imageWatermarkCard.style.display = 'none';
      renderLivePreview();
    });

    // Layout
    layoutSingleRadio.addEventListener('change', () => {
      currentRule.imageConfig.layout = 'single';
      positionGroup.style.display = 'block';
      renderLivePreview();
    });

    layoutTileRadio.addEventListener('change', () => {
      currentRule.imageConfig.layout = 'tile';
      positionGroup.style.display = 'none';
      renderLivePreview();
    });

    positionSelect.addEventListener('change', (e) => {
      currentRule.imageConfig.position = e.target.value;
      renderLivePreview();
    });

    opacityInput.addEventListener('input', (e) => {
      currentRule.imageConfig.opacity = parseInt(e.target.value) || 0;
      renderLivePreview();
    });

    sizeInput.addEventListener('input', (e) => {
      currentRule.imageConfig.sizePx = parseInt(e.target.value) || 300;
      renderLivePreview();
    });

    moreOptionsToggle.addEventListener('click', () => {
      moreOptionsContent.classList.toggle('open');
      moreOptionsToggle.textContent = moreOptionsContent.classList.contains('open') ? 'Fewer options ⌃' : 'More options ⌵';
    });

    imageRotationInput.addEventListener('input', (e) => {
      currentRule.imageConfig.rotation = parseInt(e.target.value) || 0;
      renderLivePreview();
    });

    // Applies to
    appliesProductsSelect.addEventListener('change', (e) => {
      currentRule.appliesTo.products = e.target.value;
    });

    appliesImagesSelect.addEventListener('change', (e) => {
      currentRule.appliesTo.images = e.target.value;
    });

    skipWatermarkedCheck.addEventListener('change', (e) => {
      currentRule.appliesTo.skipAlreadyWatermarked = e.target.checked;
    });

    applyNewImagesCheck.addEventListener('change', (e) => {
      currentRule.appliesTo.applyToNewImages = e.target.checked;
    });

    // Preview product & image changes
    previewProductSelect.addEventListener('change', (e) => {
      selectedProduct = productsList.find((p) => p.id === e.target.value);
      populateImageDropdown();
    });

    previewImageSelect.addEventListener('change', (e) => {
      selectedImageIndex = parseInt(e.target.value) || 0;
      updateBaseImage();
    });

    // View Larger Modal
    btnViewLarger.addEventListener('click', async () => {
      const canvas = await generateHighResCanvas();
      modalImg.src = canvas.toDataURL('image/jpeg', 0.95);
      modalBackdrop.classList.add('open');
    });

    modalClose.addEventListener('click', () => {
      modalBackdrop.classList.remove('open');
    });

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
    });

    // Download Watermarked Preview
    btnDownload.addEventListener('click', async () => {
      showToast('Generating watermarked download...');
      const canvas = await generateHighResCanvas();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/jpeg', 0.95);
      a.download = `watermarked_${selectedProduct ? selectedProduct.handle : 'product'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Preview downloaded successfully!');
    });

    // Save Rule
    btnSaveRule.addEventListener('click', async () => {
      try {
        btnSaveRule.textContent = 'Saving...';
        const res = await fetch(`/api/watermark/rules/${currentRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentRule)
        });
        const data = await res.json();
        if (data.success) {
          showToast('Rule saved successfully!');
        } else {
          showToast('Failed to save rule', true);
        }
      } catch (err) {
        showToast('Error saving rule', true);
      } finally {
        btnSaveRule.textContent = 'Save';
      }
    });

    // Apply Rule (Batch Processing)
    if (btnApplyRule) {
      btnApplyRule.addEventListener('click', async () => {
        try {
          btnApplyRule.textContent = 'Applying to store...';
          const res = await fetch(`/api/watermark/rules/${currentRule.id}/apply`, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            showToast(`✅ ${data.message}`);
          }
        } catch (err) {
          showToast('Failed to execute batch watermark', true);
        } finally {
          btnApplyRule.textContent = 'Apply to Store Products';
        }
      });
    }

    // Window resize handler for preview
    window.addEventListener('resize', () => {
      renderLivePreview();
    });
  }

  // Toast Notification
  function showToast(msg, isError = false) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'toast-banner';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = isError ? 'toast-banner show error' : 'toast-banner show success';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }

  init();
});
