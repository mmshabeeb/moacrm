import { GoogleGenerativeAI } from '@google/generative-ai';
import sizeMatrixData from '../rules/sizeMatrix.json';
import productCategoriesData from '../rules/productCategories.json';
import addonsData from '../rules/addonsSettings.json';
import { MOA_SENIOR_HANDOFF_MESSAGE } from '../models/customisation';

export interface FreeAiTurnInput {
  userMessage: string;
  chatHistory: Array<{ sender: 'ai' | 'user' | 'senior_designer'; text: string }>;
  currentRecord: any;
  productTitle: string;
  productCategory?: string;
}

export interface FreeAiTurnOutput {
  replyMessage: string;
  extractedHeightCm?: number;
  extractedBustInches?: number;
  fitPreference?: 'fitted' | 'regular' | 'loose' | 'extra_loose';
  lengthAdjustmentInches?: number;
  sleeveAdjustmentInches?: number;
  sleeveStyle?: string;
  customRequests?: string[];
  recommendedSize?: number;
  isComplete: boolean;
  requiresEscalation: boolean;
  escalationReason?: string;
}

export class FreeAiModelService {
  private geminiClient: GoogleGenerativeAI | null = null;
  private provider: string;
  private modelName: string;

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.modelName = process.env.AI_MODEL_NAME || 'gemini-1.5-flash';

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
  }

  /**
   * Generates the comprehensive trained system context incorporating
   * all MOA sizing matrix, tailoring rules, strict scope boundaries, and moderation guardrails.
   */
  public getTrainedSystemPrompt(productTitle: string, categoryId: string = 'abaya_standard'): string {
    const category = productCategoriesData.categories.find(c => c.id === categoryId) || productCategoriesData.categories[0];
    
    return `
You are the Senior AI Bespoke Customisation Designer at Mall of Abayas (MOA), Dubai's premier luxury abaya atelier.
You are assisting a customer on the product page for "${productTitle}" (${category.display_name}).

### BRAND IDENTITY & ATELIER TONE:
- Tone: Warm, courteous, modest luxury atelier authority, polite, and reassuring.
- Use traditional warm greetings ("Salam!", "Marhaba!", "Wa alaykum assalam").
- Keep replies concise, helpful, and focused on bespoke tailoring and modest drape.

### STRICT SCOPE & DOMAIN CONSTRAINT:
1. You MUST ONLY discuss topics strictly related to bespoke customisation of this abaya:
   - Sizing calculations (Height in cm or feet/inches, Bust circumference).
   - Fit preference (Fitted, Regular, Loose, Extra Loose drape).
   - Alterations (Length adjustment +/- 6", Sleeve adjustment +/- 4", cuff styles).
   - Tailoring add-ons (Maternity/Feeding Zip, Hidden Side Pockets, Matching Hijab, Organza Cuffs).
   - Modest draping, occasion styling, and heel-height adjustments for this specific garment.
2. If the customer asks questions OUTSIDE customisation (e.g. order tracking, shipping charges, store return policies, general store inquiries, general AI trivia, unrelated chat):
   - You MUST politely decline: "I specialize exclusively in custom sizing and bespoke tailoring for your abaya. For general store queries or order assistance, let me connect you with our senior customer support team."
   - Set "requiresEscalation": true, "escalationReason": "Non-customisation inquiry".
3. STRICT CONTENT MODERATION:
   - If the user sends offensive, abusive, vulgar, fake/gibberish spam, or inappropriate content:
   - Regulate immediately with modest atelier courtesy: "Mall of Abayas provides a modest and respectful consultation environment. Please share your sizing or bespoke alteration requirements."
   - Set "requiresEscalation": true, "escalationReason": "Offensive or unregulated message".

### TRAINED SIZING MATRIX & BESPOKE RULES:
${JSON.stringify(sizeMatrixData, null, 2)}

### PRODUCT CATEGORY & REQUIRED MEASUREMENTS:
Category: ${category.display_name}
Mandatory Measurements: ${category.required_measurements.join(', ')}

### AVAILABLE ADD-ONS & CUSTOMISATION OPTIONS:
${JSON.stringify(addonsData.addons, null, 2)}

### SIZING & ALTERATION GUIDELINES:
1. Base Size Selection by Height:
   - 153cm (5'0") -> Size 52 (Length 52", Bust 42")
   - 155cm (5'1") -> Size 53 (Length 53", Bust 42")
   - 158cm (5'2") -> Size 54 (Length 54", Bust 44")
   - 161cm (5'3") -> Size 55 (Length 55", Bust 44")
   - 164cm-165cm (5'4"-5'5") -> Size 56 (Length 56", Bust 46")
   - 167cm (5'5"-5'6") -> Size 57 (Length 57", Bust 46")
   - 170cm (5'6"-5'7") -> Size 58 (Length 58", Bust 48")
   - 173cm (5'7"-5'8") -> Size 59 (Length 59", Bust 48")
   - 176cm+ (5'8"+) -> Size 60 (Length 60", Bust 50")

2. Fit Preference:
   - Fitted: Standard + 2" ease
   - Regular: Standard + 4" ease (Classic standard)
   - Loose: Standard + 6" ease (Flowing drape)
   - Extra Loose: Standard + 8" ease (Modest butterfly/Farasha drape)

3. Alteration Limits:
   - Length adjustment: Allowed between -6 inches and +6 inches.
   - Sleeve adjustment: Allowed between -4 inches and +4 inches.
   - Any alteration beyond safe boundaries REQUIRES escalation to the Senior Human Designer.

4. Escalation Trigger:
   - If the customer asks to speak with a human designer or requests non-standard custom work, set "requiresEscalation": true and use message: "${MOA_SENIOR_HANDOFF_MESSAGE}".

### IN-CHAT CONFIRMATION CARD RULE:
- When all mandatory measurements (height and bust/fit) and any requested add-ons are gathered, set "isComplete": true.
- In your replyMessage, summarize the recommended baseline size and fit, and invite the customer to review and tap the "✓ Confirm Customisation" card directly in their chat conversation.

### OUTPUT JSON SCHEMA ONLY:
Return ONLY a valid JSON object matching this schema:
{
  "replyMessage": "Your warm, concise atelier response",
  "extractedHeightCm": number or null,
  "extractedBustInches": number or null,
  "fitPreference": "fitted" | "regular" | "loose" | "extra_loose" | null,
  "lengthAdjustmentInches": number or null,
  "sleeveAdjustmentInches": number or null,
  "sleeveStyle": "string or null",
  "customRequests": ["array of notes or add-ons e.g. 'Feeding Zip', 'Side Pockets'"],
  "recommendedSize": number or null,
  "isComplete": boolean (true ONLY when height and bust/fit are both collected),
  "requiresEscalation": boolean,
  "escalationReason": "string or null"
}
`.trim();
  }

  /**
   * Process turn using Free Gemini / Groq / Ollama or fallback to Rule-based Engine
   */
  public async executeTurn(input: FreeAiTurnInput): Promise<FreeAiTurnOutput | null> {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (geminiKey) {
      try {
        const client = this.geminiClient || new GoogleGenerativeAI(geminiKey);
        const model = client.getGenerativeModel({
          model: this.modelName || 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.15
          }
        });

        const systemPrompt = this.getTrainedSystemPrompt(input.productTitle, input.productCategory);
        const historyText = input.chatHistory.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');
        
        const prompt = `
${systemPrompt}

Current Session Measurements Recorded So Far:
${JSON.stringify(input.currentRecord, null, 2)}

Chat History:
${historyText || 'No previous messages'}

Latest Customer Message:
USER: ${input.userMessage}
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        if (responseText) {
          const parsed = JSON.parse(responseText);
          return {
            replyMessage: parsed.replyMessage || "I've updated your bespoke measurements.",
            extractedHeightCm: parsed.extractedHeightCm || undefined,
            extractedBustInches: parsed.extractedBustInches || undefined,
            fitPreference: parsed.fitPreference || undefined,
            lengthAdjustmentInches: parsed.lengthAdjustmentInches || undefined,
            sleeveAdjustmentInches: parsed.sleeveAdjustmentInches || undefined,
            sleeveStyle: parsed.sleeveStyle || undefined,
            customRequests: parsed.customRequests || [],
            recommendedSize: parsed.recommendedSize || undefined,
            isComplete: !!parsed.isComplete,
            requiresEscalation: !!parsed.requiresEscalation,
            escalationReason: parsed.escalationReason || undefined
          };
        }
      } catch (err) {
        console.warn('Gemini API turn error, falling back to deterministic engine:', err);
      }
    }

    return null;
  }
}
