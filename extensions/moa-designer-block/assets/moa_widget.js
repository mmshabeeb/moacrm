/**
 * Mall of Abayas (MOA) - Luxury Floating Storefront PDP Customisation Widget
 * Floating Bubble Launcher, Collapsible Modal Window & Proactive AI Designer
 */

(function () {
  class MOACustomisationWidget {
    constructor() {
      this.container = document.getElementById('moa-customisation-root');
      if (!this.container) return;

      this.productId = this.container.getAttribute('data-product-id') || '10482';
      this.productTitle = this.container.getAttribute('data-product-title') || document.title || 'Royal Silk Velvet Abaya';
      this.productCategory = this.container.getAttribute('data-product-category') || 'abaya_standard';
      this.apiBase = window.MOA_CRM_BASE_URL || window.location.origin;

      // Session token persistence
      this.sessionKey = `moa_sess_${this.productId}`;
      this.sessionToken = localStorage.getItem(this.sessionKey) || `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`;
      localStorage.setItem(this.sessionKey, this.sessionToken);

      this.isConfirmed = false;
      this.isCustomising = false;
      this.userHasTexted = false;
      this.idleTimeout = null;
      this.nudgeCount = 0;
      this.unreadCount = 0;

      this.initElements();
      this.bindEvents();
    }

    initElements() {
      this.checkbox = document.getElementById('moa-customise-checkbox');
      this.launcher = document.getElementById('moa-floating-launcher');
      this.launcherBadge = document.getElementById('moa-launcher-badge');
      this.panel = document.getElementById('moa-designer-panel');
      this.messagesContainer = document.getElementById('moa-chat-messages');
      this.verificationSlot = document.getElementById('moa-verification-slot');
      this.form = document.getElementById('moa-chat-form');
      this.input = document.getElementById('moa-user-input');
      this.minimizeBtn = document.getElementById('moa-minimize-chat');

      // Hidden Shopify Line Item Property fields
      this.props = {
        id: document.getElementById('prop-moa-id'),
        fit: document.getElementById('prop-moa-fit'),
        height: document.getElementById('prop-moa-height'),
        bust: document.getElementById('prop-moa-bust'),
        length: document.getElementById('prop-moa-length'),
        sleeve: document.getElementById('prop-moa-sleeve'),
        notes: document.getElementById('prop-moa-notes')
      };
    }

    bindEvents() {
      if (this.checkbox) {
        this.checkbox.addEventListener('change', (e) => {
          this.setCustomisationActive(e.target.checked);
        });
      }

      if (this.launcher) {
        this.launcher.addEventListener('click', () => {
          this.openPanel();
        });
      }

      if (this.minimizeBtn) {
        this.minimizeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.minimizePanel();
        });
      }

      if (this.form) {
        this.form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSendMessage();
        });
      }

      if (this.input) {
        this.input.addEventListener('input', () => {
          if (this.input.value.trim().length > 0) {
            this.clearIdleNudgeTimer();
          }
        });
      }
    }

    setCustomisationActive(active) {
      this.isCustomising = active;
      if (this.checkbox) this.checkbox.checked = active;

      if (active) {
        // Checked: Open the floating modal window directly
        this.openPanel();
        this.updateCartButtonState(true);

        if (!this.userHasTexted && this.nudgeCount === 0) {
          this.startIdleNudgeTimer();
        }
      } else {
        // Unchecked: Close everything and reset cart button
        this.closeAll();
        this.updateCartButtonState(false);
        this.clearIdleNudgeTimer();
      }
    }

    openPanel() {
      if (this.panel) {
        this.panel.style.display = 'flex';
        setTimeout(() => {
          this.input?.focus();
          this.scrollToBottom();
        }, 50);
      }
      if (this.launcher) {
        this.launcher.style.display = 'none';
      }
      this.unreadCount = 0;
      this.updateLauncherBadge();
    }

    minimizePanel() {
      if (this.panel) {
        this.panel.style.display = 'none';
      }
      if (this.isCustomising && this.launcher) {
        this.launcher.style.display = 'flex';
      }
    }

    togglePanel() {
      if (this.panel && this.panel.style.display === 'flex') {
        this.minimizePanel();
      } else {
        this.openPanel();
      }
    }

    closeAll() {
      if (this.panel) this.panel.style.display = 'none';
      if (this.launcher) this.launcher.style.display = 'none';
    }

    updateLauncherBadge() {
      if (!this.launcherBadge) return;
      if (this.unreadCount > 0) {
        this.launcherBadge.innerText = this.unreadCount;
        this.launcherBadge.style.display = 'inline-block';
      } else {
        this.launcherBadge.style.display = 'none';
      }
    }

    startIdleNudgeTimer() {
      this.clearIdleNudgeTimer();
      // First gentle nudge after 5 seconds of idle opening
      this.idleTimeout = setTimeout(() => {
        if (!this.userHasTexted && this.isCustomising && !this.isConfirmed) {
          this.showTypingIndicator();
          setTimeout(() => {
            this.removeTypingIndicator();
            if (!this.userHasTexted && this.isCustomising && !this.isConfirmed) {
              this.appendMessage({
                incoming: true,
                author: 'MOA AI Designer',
                text: "Marhaba! 👋 To calculate your bespoke length and size, what is your height (e.g. 160 cm or 5'3\") and preferred bust fit?",
                time: this.formatCurrentTime()
              });
              this.nudgeCount++;

              // Second follow-up after 9 more seconds if still idle
              this.idleTimeout = setTimeout(() => {
                if (!this.userHasTexted && this.isCustomising && !this.isConfirmed) {
                  this.showTypingIndicator();
                  setTimeout(() => {
                    this.removeTypingIndicator();
                    if (!this.userHasTexted && this.isCustomising && !this.isConfirmed) {
                      this.appendMessage({
                        incoming: true,
                        author: 'MOA AI Designer',
                        text: "💡 Tip: You can also tap one of the quick buttons above (like '📏 Height 165cm, Bust 38\"' or '✨ Loose Fit +2\" Sleeve') to start immediately! 🎀",
                        time: this.formatCurrentTime()
                      });
                      this.nudgeCount++;
                    }
                  }, 1200);
                }
              }, 9000);
            }
          }, 1200);
        }
      }, 5000);
    }

    clearIdleNudgeTimer() {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }
    }

    updateCartButtonState(isCustomising) {
      const atcBtn = document.querySelector('form[action*="/cart/add"] button[type="submit"], #AddToCart, .product-form__submit, #demo-add-to-cart-btn');
      const buyNowBtn = document.querySelector('.pdp-btn-buy-now, .shopify-payment-button__button');

      if (!atcBtn) return;

      if (isCustomising) {
        if (!this.isConfirmed) {
          // Customisation active but NOT yet confirmed -> INACTIVE
          atcBtn.disabled = true;
          atcBtn.style.opacity = '0.75';
          atcBtn.style.cursor = 'not-allowed';
          atcBtn.style.background = '#8c939d';
          atcBtn.style.color = '#ffffff';
          atcBtn.style.borderRadius = '30px';
          atcBtn.style.boxShadow = 'none';
          atcBtn.innerHTML = `🔒 Confirm Customisation in Chat to Add to Cart`;

          if (buyNowBtn) {
            buyNowBtn.disabled = true;
            buyNowBtn.style.opacity = '0.5';
            buyNowBtn.style.cursor = 'not-allowed';
          }
        } else {
          // Customisation active and CONFIRMED -> ACTIVE
          atcBtn.disabled = false;
          atcBtn.style.opacity = '1';
          atcBtn.style.cursor = 'pointer';
          atcBtn.style.background = '#111111';
          atcBtn.style.color = '#ffffff';
          atcBtn.style.borderRadius = '30px';
          atcBtn.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
          atcBtn.innerHTML = `🛍️ Add Customised Abaya to Bag`;

          if (buyNowBtn) {
            buyNowBtn.disabled = false;
            buyNowBtn.style.opacity = '1';
            buyNowBtn.style.cursor = 'pointer';
            buyNowBtn.innerText = 'Instant Customised Checkout';
          }
        }
      } else {
        // Standard non-customised purchase -> NORMAL ACTIVE
        atcBtn.disabled = false;
        atcBtn.style.opacity = '1';
        atcBtn.style.cursor = 'pointer';
        atcBtn.style.background = '';
        atcBtn.style.color = '';
        atcBtn.style.borderRadius = '';
        atcBtn.style.boxShadow = '';
        atcBtn.innerHTML = `<span>🛍️</span> Add to Bag`;

        if (buyNowBtn) {
          buyNowBtn.disabled = false;
          buyNowBtn.style.opacity = '1';
          buyNowBtn.style.cursor = 'pointer';
          buyNowBtn.innerText = 'Instant Checkout';
        }
      }
    }

    insertQuickEmoji(emoji) {
      if (this.input) {
        this.input.value += emoji;
        this.input.focus();
      }
    }

    sendQuickText(text) {
      this.userHasTexted = true;
      this.clearIdleNudgeTimer();
      if (this.input) {
        this.input.value = text;
        this.handleSendMessage();
      }
    }

    async handleSendMessage() {
      const text = (this.input?.value || '').trim();
      if (!text) return;

      this.userHasTexted = true;
      this.clearIdleNudgeTimer();

      // 1. Render User Message
      this.appendMessage({
        incoming: false,
        author: 'You',
        text: text,
        time: this.formatCurrentTime()
      });

      this.input.value = '';
      this.showTypingIndicator();

      // 2. Dispatch to MOA AI Designer / CRM API
      try {
        const response = await fetch(`${this.apiBase}/api/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            userMessage: text,
            productTitle: this.productTitle,
            productCategory: this.productCategory
          })
        });

        const data = await response.json();
        this.removeTypingIndicator();

        if (data.success && data.replyMessage) {
          // Render incoming message
          this.appendMessage({
            incoming: true,
            author: data.state === 'HUMAN_DESIGNER_CONNECTED' ? 'Senior Designer' : 'MOA AI Designer',
            text: data.replyMessage,
            time: this.formatCurrentTime()
          });

          // Check if verification card should be rendered
          if (data.showVerificationCard && data.verificationSummary) {
            this.renderVerificationCard(data.verificationSummary);
          }
        } else {
          this.appendMessage({
            incoming: true,
            author: 'MOA Designer',
            text: "Thank you for the details. I've recorded your measurements. Let me know if you need any other bespoke adjustments.",
            time: this.formatCurrentTime()
          });
        }
      } catch (err) {
        console.error('Error sending customisation turn', err);
        this.removeTypingIndicator();
        this.appendMessage({
          incoming: true,
          author: 'MOA Designer',
          text: "Salam! We received your measurements. Our tailoring workshop will craft this abaya with precision.",
          time: this.formatCurrentTime()
        });
      }
    }

    appendMessage({ incoming, author, text, time }) {
      if (!this.messagesContainer) return;

      const bubble = document.createElement('div');
      bubble.className = `moa-wa-bubble ${incoming ? 'moa-wa-incoming' : 'moa-wa-outgoing'}`;
      bubble.innerHTML = `
        <span class="moa-wa-author">${incoming ? author : 'You'}</span>
        <p style="margin:0;">${text}</p>
        <div class="moa-wa-meta">
          <span>${time}</span>
          ${!incoming ? '<span style="color:#8b5a2b; margin-left:3px;">✓✓</span>' : ''}
        </div>
      `;
      this.messagesContainer.appendChild(bubble);
      this.scrollToBottom();

      // If panel is minimized, increment unread badge on floating launcher
      if (incoming && this.panel && this.panel.style.display === 'none') {
        this.unreadCount++;
        this.updateLauncherBadge();
      }
    }

    showTypingIndicator() {
      this.removeTypingIndicator();
      const indicator = document.createElement('div');
      indicator.id = 'moa-typing-bubble';
      indicator.className = 'moa-typing-indicator';
      indicator.innerHTML = `
        <span class="moa-typing-dot"></span>
        <span class="moa-typing-dot"></span>
        <span class="moa-typing-dot"></span>
      `;
      this.messagesContainer?.appendChild(indicator);
      this.scrollToBottom();
    }

    removeTypingIndicator() {
      const el = document.getElementById('moa-typing-bubble');
      if (el) el.remove();
    }

    renderVerificationCard(summary) {
      if (!this.messagesContainer) return;

      // Remove any existing in-chat summary cards to avoid duplication
      const existingCards = this.messagesContainer.querySelectorAll('.moa-in-chat-card-bubble');
      existingCards.forEach(c => c.remove());

      const cardBubble = document.createElement('div');
      cardBubble.className = 'moa-wa-bubble moa-wa-incoming moa-in-chat-card-bubble';
      cardBubble.id = `moa-summary-card-${this.sessionToken}`;

      const baseSize = summary.recommendedSize || summary.recommended_size || '56';
      const height = summary.height || (summary.height_cm ? `${summary.height_cm} cm` : '165 cm');
      const bust = summary.bust || (summary.bust_inches ? `${summary.bust_inches}"` : '38"');
      const fit = (summary.fitPreference || summary.fit_preference || 'Regular').toUpperCase();
      const length = summary.lengthAdjustment || summary.length || 'Standard Length';
      const sleeve = summary.sleeveAdjustment || summary.sleeve || 'Standard';
      const addOns = summary.addOns || summary.customRequests || [];
      const addOnsHtml = addOns.length > 0 ? `
        <div class="moa-vc-chip" style="grid-column: span 2;">
          <span>Add-Ons:</span> <strong>${addOns.join(', ')}</strong>
        </div>` : '';

      cardBubble.innerHTML = `
        <div class="moa-verification-card">
          <div class="moa-vc-header">
            <span class="moa-vc-title">
              <span>✨</span> Customisation Summary
            </span>
            <span class="moa-vc-badge">Verified Fit</span>
          </div>

          <div class="moa-vc-grid">
            <div class="moa-vc-chip"><span>Base Size:</span> <strong>Size ${baseSize}</strong></div>
            <div class="moa-vc-chip"><span>Height:</span> <strong>${height}</strong></div>
            <div class="moa-vc-chip"><span>Bust:</span> <strong>${bust}</strong></div>
            <div class="moa-vc-chip"><span>Fit:</span> <strong>${fit}</strong></div>
            <div class="moa-vc-chip"><span>Length:</span> <strong>${length}</strong></div>
            <div class="moa-vc-chip"><span>Sleeve:</span> <strong>${sleeve}</strong></div>
            ${addOnsHtml}
          </div>

          <div class="moa-vc-action-row" id="moa-action-row-${this.sessionToken}">
            <button type="button" class="moa-vc-confirm-btn" id="moa-btn-confirm-customisation">
              <span>✓</span> Confirm My Customisation
            </button>
          </div>
        </div>
        <div class="moa-wa-meta">
          <span>${this.formatCurrentTime()}</span>
        </div>
      `;

      this.lastSummary = summary;
      this.messagesContainer.appendChild(cardBubble);

      const confirmBtn = cardBubble.querySelector('#moa-btn-confirm-customisation');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => this.handleConfirmCustomisation(summary));
      }

      this.scrollToBottom();
    }

    async handleConfirmCustomisation(summary) {
      const currentSummary = summary || this.lastSummary || {};
      const actionRow = document.getElementById(`moa-action-row-${this.sessionToken}`);
      if (actionRow) {
        actionRow.innerHTML = `
          <div class="moa-confirmed-status-pill">
            <span class="moa-check-circle">✓</span>
            <span>Customisation Confirmed & Added</span>
          </div>
          <button type="button" class="moa-reopen-btn" id="moa-reopen-edit-btn">
            ✏️ Edit / Adjust Measurements
          </button>
        `;

        const reopenBtn = actionRow.querySelector('#moa-reopen-edit-btn');
        if (reopenBtn) {
          reopenBtn.addEventListener('click', () => this.handleReopenCustomisation());
        }
      }

      try {
        const response = await fetch(`${this.apiBase}/api/chat/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: this.sessionToken })
        });

        const data = await response.json();
        this.isConfirmed = true;
        this.applyLineItemProperties(data.lineItemProperties || {
          '_moa_customisation_id': this.sessionToken,
          'Customisation Fit': (currentSummary.fitPreference || currentSummary.fit_preference || 'REGULAR').toUpperCase(),
          'Customisation Height': currentSummary.height || (currentSummary.height_cm ? `${currentSummary.height_cm} cm` : '165 cm'),
          'Customisation Bust': currentSummary.bust || (currentSummary.bust_inches ? `${currentSummary.bust_inches}"` : '38"'),
          'Customisation Length': currentSummary.lengthAdjustment || currentSummary.length || 'Standard',
          'Customisation Sleeve': currentSummary.sleeveAdjustment || currentSummary.sleeve || 'Standard'
        });

        // Post confirmation message to chat thread
        this.appendMessage({
          incoming: true,
          author: 'MOA Tailoring Team',
          text: `🎉 Customisation #${this.sessionToken} is confirmed! You can now tap **Add to Bag** to complete your order with bespoke specifications. If you need any adjustments later, just let me know here anytime!`,
          time: this.formatCurrentTime()
        });

        // Unlock and highlight Add to Cart button
        this.updateCartButtonState(true);
      } catch (err) {
        console.error('Error confirming customisation', err);
      }
    }

    handleReopenCustomisation() {
      this.isConfirmed = false;
      // Re-lock Add to Cart button until re-confirmed
      this.updateCartButtonState(true);

      const actionRow = document.getElementById(`moa-action-row-${this.sessionToken}`);
      if (actionRow) {
        actionRow.innerHTML = `
          <button type="button" class="moa-vc-confirm-btn" id="moa-btn-confirm-customisation">
            <span>✓</span> Confirm My Customisation
          </button>
        `;
        const confirmBtn = actionRow.querySelector('#moa-btn-confirm-customisation');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => this.handleConfirmCustomisation(this.lastSummary || {}));
        }
      }

      this.appendMessage({
        incoming: true,
        author: 'MOA AI Designer',
        text: "Customisation reopened for editing! What would you like to adjust? (e.g. height, sleeve length, fit drape, or add-ons). Once done, tap 'Confirm My Customisation' above.",
        time: this.formatCurrentTime()
      });
      if (this.input) {
        this.input.focus();
      }
    }

    applyLineItemProperties(props) {
      // Enable and populate hidden inputs inside the Shopify product form
      if (this.props.id) {
        this.props.id.value = props['_moa_customisation_id'] || this.sessionToken;
        this.props.id.removeAttribute('disabled');
      }
      if (this.props.fit) {
        this.props.fit.value = props['Customisation Fit'] || 'REGULAR';
        this.props.fit.removeAttribute('disabled');
      }
      if (this.props.height) {
        this.props.height.value = props['Customisation Height'] || '';
        this.props.height.removeAttribute('disabled');
      }
      if (this.props.bust) {
        this.props.bust.value = props['Customisation Bust'] || '';
        this.props.bust.removeAttribute('disabled');
      }
      if (this.props.length) {
        this.props.length.value = props['Customisation Length'] || 'Standard';
        this.props.length.removeAttribute('disabled');
      }
      if (this.props.sleeve) {
        this.props.sleeve.value = props['Customisation Sleeve'] || 'Standard';
        this.props.sleeve.removeAttribute('disabled');
      }
      if (this.props.notes) {
        this.props.notes.value = props['Customisation Notes'] || '';
        this.props.notes.removeAttribute('disabled');
      }
    }

    scrollToBottom() {
      if (this.messagesContainer) {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      }
    }

    formatCurrentTime() {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.MOA_WIDGET = new MOACustomisationWidget();
    });
  } else {
    window.MOA_WIDGET = new MOACustomisationWidget();
  }
})();
