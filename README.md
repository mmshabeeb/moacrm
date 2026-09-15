# Mall of Abayas (MOA) AI Designer & Customisation System
## Architecture, Rules, Free AI Model & Knowledge Repository

This repository hosts the **MOA Conversational Customisation Engine, Knowledge System, Shopify Integration, and Free AI Model Adapter**.

---

### 🧠 Free AI Model Integration & Trained Data

The system natively connects to free AI models and feeds them with the complete MOA bespoke atelier training dataset.

#### 1. Supported Free AI Model Options:
- **Option A: Google Gemini Free Tier (`gemini-1.5-flash` / `gemini-2.0-flash`)**
  - Get a 100% free API key from [Google AI Studio](https://aistudio.google.com/).
  - Set `GEMINI_API_KEY=your_key_here` in `.env`.
- **Option B: Groq Free Tier (`llama-3.3-70b-versatile` / `llama3-8b-8192`)**
  - Get a free API key from [Groq Cloud Console](https://console.groq.com/).
  - Set `GROQ_API_KEY=your_key_here` and `AI_PROVIDER=groq` in `.env`.
- **Option C: Ollama Local (100% Free / Private / No API Key)**
  - Run Ollama locally on `http://localhost:11434` (`llama3`, `mistral`, or `gemma`).
  - Set `OLLAMA_BASE_URL=http://localhost:11434` in `.env`.
- **Option D: Built-in Deterministic Trained NLP Engine (Zero Dependencies Fallback)**
  - Operates automatically if no API key is provided, ensuring zero downtime and 100% reliable sizing calculations.

#### 2. Embedded Trained Data & Knowledge Base:
- **Sizing Matrix & Conversion Knowledge (`/src/rules/sizeMatrix.json`)**:
  - Height-to-abaya size mapping (Size 52 to 60 for heights 153 cm to 176 cm / 5'0" to 5'8"+).
  - Bust flat vs circumference dimensions and ease profiles (Fitted +2", Regular +4", Loose +6", Extra Loose +8").
  - Alteration limits (Length max ±6", Sleeve max ±4", beyond limits triggers senior escalation).
- **Product Categories & Customisation Rules (`/src/rules/productCategories.json`)**:
  - Standard Abayas, Occasion Velvets, Kimono Abayas, Mom's Modest Sets, Kaftans & Farasha.
- **Add-on Catalog & Pricing (`/src/rules/addonsSettings.json`)**:
  - Matching Sheila/Hijab, Pockets, Maternity Zips, Belts.
- **Brand Persona & Escalation Boundaries**:
  - Warm, polite, respectful Dubai modest fashion authority with automatic Senior Designer handoff.

---

### 🚀 Gated Add-to-Cart Storefront Flow

1. Customer ticks **"Need Customisations?"** on the Product Page.
2. The `Add to Cart` button is locked (`🔒 Confirm Customisation in Chat to Add to Cart`).
3. If the customer is idle for 5s, the AI proactively initiates the chat to ask for height and bust.
4. AI extracts measurements and presents the **Customisation Summary Card**.
5. Once confirmed, the button unlocks as **`🛍️ Add Customised Abaya to Bag`** and attaches hidden line item properties (`_moa_customisation_id`, `Customisation Height`, `Customisation Bust`, `Customisation Fit`, `Customisation Sleeve`, `Customisation Length`).
