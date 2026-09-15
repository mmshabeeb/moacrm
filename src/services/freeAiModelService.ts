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
    this.modelName = process.env.AI_MODEL_NAME || 'gemini-3.6-flash';

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

### BRAND IDENTITY & CONVERSATIONAL EXPERTISE:
- Role: An attentive, expert fashion designer at Mall of Abayas (MOA) luxury atelier in Dubai.
- Tone: Highly conversational, empathetic, warm, modest luxury, polite, and natural.
- Rule: Always respond directly and specifically to what the customer actually asked.

### CONVERSATIONAL RESPONSE GUIDELINES:
1. DIRECT CONTEXTUAL ANSWERS:
   - When the customer asks about an alteration or add-on (e.g. "can you make a feeding zip?", "can I get pockets?", "can you make sleeves longer?", "what length for heels?"):
     - Directly answer their question first with atelier care and clarity (e.g. "Yes, certainly! We can tailor concealed front feeding zippers seamlessly for you.", "Yes, we can add two deep hidden side pockets into the drape.").
     - Add the requested option to "customRequests" (e.g. ["Feeding Zip"]).
2. STEP-BY-STEP MEASUREMENT GUIDANCE:
   - If height or bust/fit are missing: Guide the customer step-by-step in a friendly conversational manner (e.g. "To calculate your exact base size and length for ${productTitle}, what is your height and preferred fit?").
3. IN-CHAT CONFIRMATION CARD:
   - When mandatory measurements (height and bust/fit) are collected:
     - Set "isComplete": true.
     - In your replyMessage, naturally mention their tailored size recommendation and that their bespoke specifications (including any requested alterations/add-ons) have been prepared in the confirmation card in this chat.
   - If the customer continues asking questions or adjusting details after the card is displayed: Answer their specific question conversationally and keep all measurements updated.
4. GREETINGS:
   - If the customer says "hi", "hello", "salam", or "hey", warmly welcome them: "Salam! Welcome to Mall of Abayas. I'm here to help tailor your ${productTitle} to your exact measurements. What is your height and preferred fit?"
   - Never use awkward phrases like "Of course!" to a simple greeting.

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
      const client = this.geminiClient || new GoogleGenerativeAI(geminiKey);
      const candidateModels = [
        this.modelName,
        'gemini-3.6-flash',
        'gemini-flash-latest',
        'gemini-3.5-flash',
        'gemini-2.5-flash-lite'
      ].filter(Boolean);

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

      for (const candidate of candidateModels) {
        try {
          const model = client.getGenerativeModel({
            model: candidate,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2
            }
          });

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
        } catch (err: any) {
          console.warn(`Gemini model ${candidate} failed: ${err.message}, trying next candidate...`);
        }
      }
    }

    return null;
  }
}
