/**
 * MOA Storefront Gating & Chat Controller
 * Manages the "Need Customisations?" toggle and intercepts Shopify PDP Add-to-Cart.
 */

export class MOAStorefrontWidget {
  private checkbox: HTMLInputElement | null = null;
  private designerPanel: HTMLElement | null = null;
  private chatForm: HTMLFormElement | null = null;
  private inputField: HTMLInputElement | null = null;
  private chatThread: HTMLElement | null = null;
  private verificationSlot: HTMLElement | null = null;
  private addToCartBtn: HTMLButtonElement | null = null;

  private isCustomisationActive: boolean = false;
  private isCustomisationConfirmed: boolean = false;
  private customisationId: string = '';

  constructor() {
    this.init();
  }

  private init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindElements();
      this.bindEvents();
    });
  }

  private bindElements() {
    this.checkbox = document.querySelector('#moa-customise-checkbox');
    this.designerPanel = document.querySelector('#moa-designer-panel');
    this.chatForm = document.querySelector('#moa-chat-form');
    this.inputField = document.querySelector('#moa-user-input');
    this.chatThread = document.querySelector('#moa-chat-messages');
    this.verificationSlot = document.querySelector('#moa-verification-slot');

    // Locate the Shopify theme's main Add-to-Cart button
    this.addToCartBtn = document.querySelector(
      'form[action*="/cart/add"] button[type="submit"], button[name="add"], .product-form__submit, #AddToCart'
    );
  }

  private bindEvents() {
    if (this.checkbox) {
      this.checkbox.addEventListener('change', (e) => {
        this.toggleCustomisationMode((e.target as HTMLInputElement).checked);
      });
    }

    if (this.chatForm) {
      this.chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCustomerSendMessage();
      });
    }
  }

  /**
   * Toggles between standard purchase and gated customisation workflow
   */
  public toggleCustomisationMode(enabled: boolean) {
    this.isCustomisationActive = enabled;

    if (this.designerPanel) {
      this.designerPanel.style.display = enabled ? 'block' : 'none';
    }

    if (enabled) {
      // If checked but not yet confirmed, lock the Add to Cart button
      if (!this.isCustomisationConfirmed) {
        this.lockAddToCart("Complete Customisation with Designer");
      }
    } else {
      // If unchecked, restore normal Add to Cart functionality
      this.unlockAddToCart("Add to Cart");
      this.disableCustomisationInputs();
    }
  }

  /**
   * Locks the theme's Add to Cart button
   */
  private lockAddToCart(buttonText: string) {
    if (!this.addToCartBtn) return;
    this.addToCartBtn.disabled = true;
    this.addToCartBtn.setAttribute('data-moa-original-text', this.addToCartBtn.innerText);
    this.addToCartBtn.innerHTML = `🔒 ${buttonText}`;
    this.addToCartBtn.classList.add('moa-btn-locked');
  }

  /**
   * Unlocks the theme's Add to Cart button
   */
  private unlockAddToCart(buttonText?: string) {
    if (!this.addToCartBtn) return;
    this.addToCartBtn.disabled = false;
    const origText = this.addToCartBtn.getAttribute('data-moa-original-text') || 'Add to Cart';
    this.addToCartBtn.innerHTML = buttonText || origText;
    this.addToCartBtn.classList.remove('moa-btn-locked');
  }

  /**
   * Called when customer clicks "Confirm My Customisation" on the verification card
   */
  public confirmCustomisation(summary: {
    id: string;
    fit: string;
    height: string;
    bust: string;
    length: string;
    sleeve: string;
    notes?: string;
  }) {
    this.isCustomisationConfirmed = true;
    this.customisationId = summary.id;

    // Enable and populate hidden line item properties on the Shopify product form
    this.setLineItemProperty('prop-moa-id', summary.id);
    this.setLineItemProperty('prop-moa-fit', summary.fit);
    this.setLineItemProperty('prop-moa-height', summary.height);
    this.setLineItemProperty('prop-moa-bust', summary.bust);
    this.setLineItemProperty('prop-moa-length', summary.length);
    this.setLineItemProperty('prop-moa-sleeve', summary.sleeve);
    if (summary.notes) {
      this.setLineItemProperty('prop-moa-notes', summary.notes);
    }

    // Unlock Add to Cart with confirmed status
    this.unlockAddToCart("✓ Add Customised Abaya to Cart");
    this.appendMessage('ai', "✓ Customisation confirmed! You can now click **Add to Cart** below.");
  }

  private setLineItemProperty(elementId: string, value: string) {
    const input = document.getElementById(elementId) as HTMLInputElement | null;
    if (input) {
      input.value = value;
      input.disabled = false;
    }
  }

  private disableCustomisationInputs() {
    const propertyInputs = document.querySelectorAll<HTMLInputElement>('input[name^="properties[_moa_"]');
    propertyInputs.forEach((input) => {
      input.disabled = true;
      input.value = '';
    });
  }

  private handleCustomerSendMessage() {
    if (!this.inputField || !this.inputField.value.trim()) return;
    const text = this.inputField.value.trim();
    this.appendMessage('user', text);
    this.inputField.value = '';

    // Simulate / Trigger AI consultation turn
    // (In full app, invokes /apps/moa-designer/api/chat)
  }

  public appendMessage(sender: 'ai' | 'user' | 'senior_designer', text: string) {
    if (!this.chatThread) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `moa-message moa-message-${sender}`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    this.chatThread.appendChild(msgDiv);
    this.chatThread.scrollTop = this.chatThread.scrollHeight;
  }
}
