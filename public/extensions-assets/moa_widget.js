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

      // Smart API Base URL: auto-detects https://ai.mallofabayas.com from script tag or fallback
      let detectedOrigin = 'https://ai.mallofabayas.com';
      try {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          detectedOrigin = window.location.origin;
        } else if (document.currentScript && document.currentScript.src) {
          const scriptUrl = new URL(document.currentScript.src);
          if (scriptUrl.origin && !scriptUrl.origin.includes('shopify.com')) {
            detectedOrigin = scriptUrl.origin;
          }
        }
      } catch (e) {}

      this.apiBase = window.MOA_CRM_BASE_URL || detectedOrigin;

      // Session token persistence
      this.sessionKey = `moa_sess_${this.productId}`;
      this.sessionToken = localStorage.getItem(this.sessionKey) || `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`;
      localStorage.setItem(this.sessionKey, this.sessionToken);

      // Customer Identity (from Shopify Liquid attributes or cached profile)
      const liquidId = this.container.getAttribute('data-customer-id') || '';
      const liquidName = this.container.getAttribute('data-customer-name') || '';
      const liquidEmail = this.container.getAttribute('data-customer-email') || '';
      const liquidPhone = this.container.getAttribute('data-customer-phone') || '';

      let cachedProfile = {};
      try {
        cachedProfile = JSON.parse(localStorage.getItem('moa_customer_profile') || '{}');
      } catch (e) {}

      this.customerProfile = {
        id: liquidId || cachedProfile.id || '',
        name: liquidName || cachedProfile.name || '',
        email: liquidEmail || cachedProfile.email || '',
        phone: liquidPhone || cachedProfile.phone || ''
      };

      if (this.customerProfile.name || this.customerProfile.phone) {
        localStorage.setItem('moa_customer_profile', JSON.stringify(this.customerProfile));
        this.syncCustomerInfo();
      }

      this.isConfirmed = false;
      this.isCustomising = false;
      this.userHasTexted = false;
      this.idleTimeout = null;
      this.nudgeCount = 0;
      this.unreadCount = 0;
      this.renderedHistoryCount = 0;
      this.syncPollInterval = null;

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
      this.resetBtn = document.getElementById('moa-reset-chat');
      this.micBtn = document.getElementById('moa-mic-btn');
      this.recordingBar = document.getElementById('moa-recording-bar');
      this.recTimer = document.getElementById('moa-rec-timer');
      this.recCancelBtn = document.getElementById('moa-rec-cancel');
      this.recSendBtn = document.getElementById('moa-rec-send');

      // Voice Recorder State
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.recordingInterval = null;
      this.recordingSeconds = 0;
      this.isRecording = false;

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

      if (this.resetBtn) {
        this.resetBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleResetChat();
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

      // Voice Recording Controls
      if (this.micBtn) {
        this.micBtn.addEventListener('click', () => {
          if (!this.isRecording) {
            this.startVoiceRecording();
          } else {
            this.sendVoiceRecording();
          }
        });
      }

      if (this.recCancelBtn) {
        this.recCancelBtn.addEventListener('click', () => {
          this.cancelVoiceRecording();
        });
      }

      if (this.recSendBtn) {
        this.recSendBtn.addEventListener('click', () => {
          this.sendVoiceRecording();
        });
      }
    }

    startLiveSyncPolling() {
      if (this.syncPollInterval) return;
      this.syncPollInterval = setInterval(async () => {
        if (!this.isCustomising) return;
        try {
          const res = await fetch(`${this.apiBase}/api/chat/sync/${this.sessionToken}`);
          const data = await res.json();
          if (data.success && Array.isArray(data.history)) {
            if (data.history.length > this.renderedHistoryCount) {
              const newMessages = data.history.slice(this.renderedHistoryCount);
              newMessages.forEach(msg => {
                if (msg.sender === 'senior_designer') {
                  this.appendMessage({
                    incoming: true,
                    author: data.claimedByName || 'Senior Atelier Designer',
                    text: msg.text,
                    time: msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : this.formatCurrentTime()
                  });
                }
              });
              this.renderedHistoryCount = data.history.length;
            }
          }
        } catch (e) {}
      }, 2500);
    }

    stopLiveSyncPolling() {
      if (this.syncPollInterval) {
        clearInterval(this.syncPollInterval);
        this.syncPollInterval = null;
      }
    }

    async handleResetChat() {
      if (!confirm('Start a fresh consultation for this abaya?')) return;
      this.sessionToken = `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`;
      localStorage.setItem(this.sessionKey, this.sessionToken);
      this.renderedHistoryCount = 0;
      this.isConfirmed = false;
      this.userHasTexted = false;

      if (this.messagesContainer) {
        this.messagesContainer.innerHTML = `
          <div class="moa-wa-bubble moa-wa-incoming">
            <span class="moa-wa-author">MOA Designer</span>
            <p style="margin:0;">Salam! I'm your MOA Customisation Designer. Tell me your height, preferred fit, or any alteration in your own words!</p>
            <div class="moa-wa-meta"><span>Just now</span></div>
          </div>
        `;
      }

      this.updateCartButtonState(true);

      try {
        await fetch(`${this.apiBase}/api/chat/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            productTitle: this.productTitle,
            productCategory: this.productCategory
          })
        });
        if (this.customerProfile.name) {
          await this.syncCustomerInfo();
        }
      } catch (e) {}
    }

    async syncCustomerInfo() {
      if (!this.customerProfile || (!this.customerProfile.name && !this.customerProfile.phone)) return;
      try {
        await fetch(`${this.apiBase}/api/chat/customer-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            customerName: this.customerProfile.name,
            customerPhone: this.customerProfile.phone,
            customerEmail: this.customerProfile.email,
            customerId: this.customerProfile.id,
            productTitle: this.productTitle,
            productCategory: this.productCategory
          })
        });
      } catch (err) {
        console.warn('Customer info sync error:', err);
      }
    }

    renderCustomerIdentificationGate() {
      if (this.customerProfile.name && this.customerProfile.phone) return;
      const existing = document.getElementById('moa-cust-gate');
      if (existing) return;

      const gate = document.createElement('div');
      gate.id = 'moa-cust-gate';
      gate.className = 'moa-customer-gate-card';
      gate.innerHTML = `
        <div class="moa-gate-header">
          <span class="moa-gate-badge">👑 VIP Atelier Registration</span>
          <h4 class="moa-gate-title">Welcome to Bespoke Tailoring</h4>
          <p class="moa-gate-desc">Please share your name and WhatsApp/mobile number so our AI & Senior Atelier Designers can attach your measurements and follow up on WhatsApp.</p>
        </div>
        <form id="moa-gate-form" class="moa-gate-form">
          <div class="moa-gate-field">
            <label>Your Full Name *</label>
            <input type="text" id="moa-gate-name" placeholder="e.g. Fatima Al-Nuaimi" required value="${this.customerProfile.name || ''}" />
          </div>
          <div class="moa-gate-field">
            <label>Mobile / WhatsApp Number *</label>
            <input type="tel" id="moa-gate-phone" placeholder="e.g. +971 50 123 4567 or +91 98..." required value="${this.customerProfile.phone || ''}" />
          </div>
          <div class="moa-gate-field">
            <label>Email Address (Optional)</label>
            <input type="email" id="moa-gate-email" placeholder="e.g. fatima@example.com" value="${this.customerProfile.email || ''}" />
          </div>
          <button type="submit" class="moa-gate-btn">✨ Start Bespoke Customisation</button>
          <div class="moa-gate-footer">
            <a href="/account/login?return_to=${encodeURIComponent(window.location.pathname)}" class="moa-gate-login-link">Already have an account? Sign In</a>
          </div>
        </form>
      `;

      if (this.messagesContainer) {
        this.messagesContainer.prepend(gate);
        this.scrollToBottom();
      }

      const form = gate.querySelector('#moa-gate-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = (gate.querySelector('#moa-gate-name')?.value || '').trim();
          const phone = (gate.querySelector('#moa-gate-phone')?.value || '').trim();
          const email = (gate.querySelector('#moa-gate-email')?.value || '').trim();

          if (!name || !phone) {
            alert('Please enter your Name and Mobile / WhatsApp number to proceed.');
            return;
          }

          this.customerProfile = {
            id: this.customerProfile.id || `CUST-${Math.floor(100000 + Math.random() * 900000)}`,
            name,
            phone,
            email
          };
          localStorage.setItem('moa_customer_profile', JSON.stringify(this.customerProfile));
          gate.remove();

          // Dispatch to CRM
          this.syncCustomerInfo();

          this.appendMessage({
            incoming: true,
            author: 'MOA AI Designer',
            text: `Marhaba ${name}! 👋 Your bespoke customisation dossier is ready. What is your height (e.g. 165 cm) and preferred fit?`,
            time: this.formatCurrentTime()
          });
          if (this.input) this.input.focus();
        });
      }
    }

    setCustomisationActive(active) {
      this.isCustomising = active;
      if (this.checkbox) this.checkbox.checked = active;

      if (active) {
        // Checked: Open the floating modal window directly
        this.openPanel();
        this.renderCustomerIdentificationGate();
        this.updateCartButtonState(true);
        this.startLiveSyncPolling();

        if (!this.userHasTexted && this.nudgeCount === 0) {
          this.startIdleNudgeTimer();
        }
      } else {
        // Unchecked: Close everything and reset cart button
        this.closeAll();
        this.updateCartButtonState(false);
        this.clearIdleNudgeTimer();
        this.stopLiveSyncPolling();
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
            productCategory: this.productCategory,
            customerInfo: this.customerProfile,
            customerName: this.customerProfile?.name,
            customerPhone: this.customerProfile?.phone,
            customerEmail: this.customerProfile?.email,
            customerId: this.customerProfile?.id
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

    /* --------------------------------------------------------------------------
       WhatsApp-Style Voice Note Recording Lifecycle
       -------------------------------------------------------------------------- */
    async startVoiceRecording() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert('Microphone access is not supported in this browser. Please type your message.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioChunks = [];
        
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg';
        }

        this.mediaRecorder = new MediaRecorder(stream, { mimeType });
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.start(100);
        this.isRecording = true;
        this.recordingSeconds = 0;

        // UI Updates: show recording bar, pulse mic
        if (this.recordingBar) this.recordingBar.style.display = 'flex';
        if (this.micBtn) this.micBtn.classList.add('recording');
        if (this.recTimer) this.recTimer.innerText = '0:00';

        this.recordingInterval = setInterval(() => {
          this.recordingSeconds++;
          const mins = Math.floor(this.recordingSeconds / 60);
          const secs = (this.recordingSeconds % 60).toString().padStart(2, '0');
          if (this.recTimer) this.recTimer.innerText = `${mins}:${secs}`;
        }, 1000);

        this.userHasTexted = true;
        this.clearIdleNudgeTimer();
      } catch (err) {
        console.error('Microphone access denied / error:', err);
        alert('Please allow microphone permissions to record your voice message.');
      }
    }

    cancelVoiceRecording() {
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
        if (this.mediaRecorder.stream) {
          this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
      }
      this.audioChunks = [];
      this.isRecording = false;
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
      if (this.recordingBar) this.recordingBar.style.display = 'none';
      if (this.micBtn) this.micBtn.classList.remove('recording');
    }

    async sendVoiceRecording() {
      if (!this.mediaRecorder || !this.isRecording) return;

      const durationText = this.recTimer ? this.recTimer.innerText : '0:05';
      const mimeType = this.mediaRecorder.mimeType || 'audio/webm';

      this.mediaRecorder.onstop = async () => {
        if (this.mediaRecorder.stream) {
          this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }

        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        if (audioBlob.size === 0) return;

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64DataUrl = reader.result;
          const base64Audio = base64DataUrl.split(',')[1];

          // Render Outgoing Voice Note Bubble
          this.appendVoiceMessage({
            incoming: false,
            author: 'You',
            audioUrl: base64DataUrl,
            duration: durationText,
            time: this.formatCurrentTime()
          });

          this.showTypingIndicator();

          try {
            const response = await fetch(`${this.apiBase}/api/chat/voice-message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionToken: this.sessionToken,
                audioBase64: base64Audio,
                mimeType: mimeType,
                productTitle: this.productTitle,
                productCategory: this.productCategory,
                customerInfo: this.customerProfile,
                customerName: this.customerProfile?.name,
                customerPhone: this.customerProfile?.phone,
                customerEmail: this.customerProfile?.email,
                customerId: this.customerProfile?.id
              })
            });

            const data = await response.json();
            this.removeTypingIndicator();

            if (data.success && data.replyMessage) {
              this.appendMessage({
                incoming: true,
                author: data.state === 'HUMAN_DESIGNER_CONNECTED' ? 'Senior Designer' : 'MOA AI Designer',
                text: data.replyMessage,
                time: this.formatCurrentTime()
              });

              if (data.showVerificationCard && data.verificationSummary) {
                this.renderVerificationCard(data.verificationSummary);
              }
            } else {
              this.appendMessage({
                incoming: true,
                author: 'MOA Designer',
                text: "Thank you for the voice note! I've noted your bespoke tailoring specifications.",
                time: this.formatCurrentTime()
              });
            }
          } catch (err) {
            console.error('Error processing voice note:', err);
            this.removeTypingIndicator();
            this.appendMessage({
              incoming: true,
              author: 'MOA Designer',
              text: "Salam! We received your voice message. Our tailoring team will craft your abaya with care.",
              time: this.formatCurrentTime()
            });
          }
        };
      };

      this.mediaRecorder.stop();
      this.isRecording = false;
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
      if (this.recordingBar) this.recordingBar.style.display = 'none';
      if (this.micBtn) this.micBtn.classList.remove('recording');
    }

    appendVoiceMessage({ incoming, author, audioUrl, duration, time, transcript }) {
      if (!this.messagesContainer) return;

      const bubble = document.createElement('div');
      bubble.className = `moa-wa-bubble ${incoming ? 'moa-wa-incoming' : 'moa-wa-outgoing'} moa-voice-bubble`;
      
      const audioId = `moa-audio-${Math.floor(100000 + Math.random() * 900000)}`;

      bubble.innerHTML = `
        <span class="moa-wa-author">${incoming ? author : 'You'}</span>
        <div class="moa-audio-player">
          <button type="button" class="moa-audio-play-btn" id="play-${audioId}" title="Play Voice Note">
            <svg class="icon-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            <svg class="icon-pause" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <div class="moa-audio-track">
            <div class="moa-audio-progress-bar" id="bar-${audioId}">
              <div class="moa-audio-progress-fill" id="fill-${audioId}" style="width: 0%;"></div>
            </div>
            <div class="moa-audio-meta">
              <span id="time-${audioId}">0:00</span>
              <span>${duration || '0:05'}</span>
            </div>
          </div>
          <div class="moa-audio-mic-badge">🎙️</div>
        </div>
        <audio id="audio-${audioId}" src="${audioUrl}" preload="metadata"></audio>
        ${transcript ? `<p class="moa-voice-transcript"><em>🗣️ "${transcript}"</em></p>` : ''}
        <div class="moa-wa-meta">
          <span>${time}</span>
          ${!incoming ? '<span style="color:#8b5a2b; margin-left:3px;">✓✓</span>' : ''}
        </div>
      `;

      this.messagesContainer.appendChild(bubble);
      this.scrollToBottom();

      // Audio Player Click Handlers
      const audioEl = bubble.querySelector(`#audio-${audioId}`);
      const playBtn = bubble.querySelector(`#play-${audioId}`);
      const playIcon = playBtn?.querySelector('.icon-play');
      const pauseIcon = playBtn?.querySelector('.icon-pause');
      const fillBar = bubble.querySelector(`#fill-${audioId}`);
      const timeSpan = bubble.querySelector(`#time-${audioId}`);
      const progBar = bubble.querySelector(`#bar-${audioId}`);

      if (audioEl && playBtn) {
        playBtn.addEventListener('click', () => {
          if (audioEl.paused) {
            // Pause all other audios first
            document.querySelectorAll('audio').forEach(a => {
              if (a !== audioEl && !a.paused) {
                a.pause();
                a.currentTime = 0;
              }
            });
            audioEl.play();
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
          } else {
            audioEl.pause();
            if (playIcon) playIcon.style.display = 'block';
            if (pauseIcon) pauseIcon.style.display = 'none';
          }
        });

        audioEl.addEventListener('timeupdate', () => {
          if (audioEl.duration) {
            const pct = (audioEl.currentTime / audioEl.duration) * 100;
            if (fillBar) fillBar.style.width = `${pct}%`;
            const curMin = Math.floor(audioEl.currentTime / 60);
            const curSec = Math.floor(audioEl.currentTime % 60).toString().padStart(2, '0');
            if (timeSpan) timeSpan.innerText = `${curMin}:${curSec}`;
          }
        });

        audioEl.addEventListener('ended', () => {
          if (playIcon) playIcon.style.display = 'block';
          if (pauseIcon) pauseIcon.style.display = 'none';
          if (fillBar) fillBar.style.width = '0%';
          if (timeSpan) timeSpan.innerText = '0:00';
        });

        if (progBar) {
          progBar.addEventListener('click', (e) => {
            const rect = progBar.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            if (audioEl.duration) {
              audioEl.currentTime = clickPos * audioEl.duration;
            }
          });
        }
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
          body: JSON.stringify({
            sessionToken: this.sessionToken,
            customerInfo: this.customerProfile,
            customerName: this.customerProfile?.name,
            customerPhone: this.customerProfile?.phone,
            customerEmail: this.customerProfile?.email
          })
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
