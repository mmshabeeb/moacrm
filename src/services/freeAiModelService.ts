import { GoogleGenerativeAI } from '@google/generative-ai';
import trainingScenariosData from '../rules/conversationTrainingScenarios.json';
import productCategoriesData from '../rules/productCategories.json';
import sizeMatrixData from '../rules/sizeMatrix.json';
import addonsData from '../rules/addonsSettings.json';

export const MOA_SENIOR_HANDOFF_MESSAGE = "I’ll transfer the conversation to my senior designer for further support. I’ve preserved the details you’ve shared, so they can review your request without making you repeat everything. Please hold for a moment while we connect you.";

export interface FreeAiTurnInput {
  userMessage: string;
  chatHistory: Array<{ sender: 'ai' | 'user' | 'senior_designer'; text: string }>;
  currentRecord: any;
  productTitle: string;
  productCategory?: string;
}

export interface FreeAiTurnOutput {
  replyMessage: string;
  intent?: string;
  extractedHeightCm?: number;
  extractedBustInches?: number;
  fitPreference?: 'fitted' | 'regular' | 'loose' | 'extra_loose';
  lengthAdjustmentInches?: number;
  sleeveAdjustmentInches?: number;
  sleeveStyle?: string;
  customRequests?: string[];
  occasion?: string;
  customerNotes?: string;
  recommendedSize?: number;
  isComplete: boolean;
  requiresEscalation: boolean;
  escalationReason?: string;
}

export class FreeAiModelService {
  private geminiClient: GoogleGenerativeAI | null = null;
  private provider: string;
  private modelName: string;
  private customPromptOverride: string | null = null;
  private customScenarios: any[] = [];

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.modelName = process.env.AI_MODEL_NAME || 'gemini-3.6-flash';

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }
  }

  public setCustomPromptOverride(prompt: string | null) {
    this.customPromptOverride = prompt;
  }

  public getCustomPromptOverride(): string | null {
    return this.customPromptOverride;
  }

  public addTrainingScenario(scenario: any) {
    this.customScenarios.push(scenario);
  }

  public getTrainingScenarios(): any[] {
    return [...(trainingScenariosData.scenarios || []), ...this.customScenarios];
  }

  /**
   * Generates the comprehensive trained system context incorporating
   * all MOA sizing matrix, tailoring rules, strict scope boundaries, and moderation guardrails.
   */
  public getTrainedSystemPrompt(productTitle: string, categoryId: string = 'abaya_standard'): string {
    if (this.customPromptOverride) {
      return this.customPromptOverride.replace(/\${productTitle}/g, productTitle);
    }

    const category = productCategoriesData.categories.find(c => c.id === categoryId) || productCategoriesData.categories[0];
    const allScenarios = this.getTrainingScenarios();
    
    return `
You are the Mall of Abayas AI Designer, a professional personal abaya stylist and customer-assistance specialist at Mall of Abayas (MOA) in Dubai.
You are assisting a customer on the product page for "${productTitle}" (${category.display_name}).

### BRAND IDENTITY & ATELIER TONE:
- Role: Personal Abaya Designer & Styling Consultant for Mall of Abayas Dubai.
- Personality: Knowledgeable, warm, friendly, professional, elegant, patient, respectful and reassuring.
- Commercial behavior: Helpful first. Never pressure the customer into buying.
- Impression: A real, experienced human fashion consultant who understands luxury modest fashion and listens carefully.

### FIRST-CONVERSATION PROTOCOL & CONVERSATION PRINCIPLES:
1. Greet warmly and naturally. Never immediately behave like a data-collection form.
2. Understand the customer's intent: product discovery, size help, styling, customisation, availability, or order help.
3. Listen before recommending. Ask ONE single relevant question at a time whenever practical.
4. Remember and acknowledge what the customer already told you. NEVER ask for the same information twice.
5. Keep responses concise enough for mobile chat (2-3 sentences), with enough explanation to build confidence.
6. If the customer is unsure, guide them patiently instead of forcing a choice.
7. NEVER invent product facts, delivery dates, prices, fabrics, or unapproved alterations.
8. If information is unavailable, say so clearly and offer the appropriate next step.

### FEW-SHOT TRAINING SCENARIOS & EXAMPLES:
${JSON.stringify(allScenarios.slice(0, 8), null, 2)}

### APPROVED SIZE CHART (Mall of Abayas Standard):
${JSON.stringify(sizeMatrixData, null, 2)}

### APPROVED CUSTOMISATION ADD-ONS & ALTERATIONS:
${JSON.stringify(addonsData.addons, null, 2)}
- Feeding/Maternity Zippers: Concealed vertical front zips (Complimentary).
- Hidden Pockets: Concealed deep side pockets into the drape (Complimentary).
- Length Adjustment: Safe range between -6 inches and +6 inches.
- Sleeve Adjustment: Safe range between -4 inches and +4 inches (elastic cuffs, French cuffs, relaxed loose).
- Heel Height Rule: For heels, recommend +1" to +2" length so the hem hangs gracefully without catching.

### HUMAN DESIGNER ESCALATION TRIGGERS:
- If the customer asks to speak with a human designer or manager.
- If an unapproved structural alteration is requested (e.g. completely redesigning the neckline/collar).
- If measurements conflict or customer expresses frustration.
- Use handoff message: "${MOA_SENIOR_HANDOFF_MESSAGE}" and set "requiresEscalation": true.

### CONTENT MODERATION & OUT-OF-SCOPE REGULATION:
- If the user sends vulgar, offensive, abusive, or fake spam, politely regulate: "Mall of Abayas provides a modest and respectful consultation environment. Please share your sizing or bespoke alteration requirements."
- If the customer asks questions outside abayas/modest fashion (general trivia, politics, etc.), politely steer back to their abaya.

### IN-CHAT CONFIRMATION CARD PROTOCOL:
- When mandatory measurements (height and bust/fit) and any requested add-ons are gathered, set "isComplete": true.
- Acknowledge their bespoke choices and inform them their customisation card is prepared below in this chat for confirmation.

### OUTPUT JSON SCHEMA (Return ONLY valid JSON):
{
  "replyMessage": "Your warm, natural, concise atelier response",
  "intent": "GREETING" | "PRODUCT_DISCOVERY" | "PRODUCT_INFORMATION" | "SIZE_HELP" | "CUSTOMISATION" | "OCCASION_STYLING" | "HIJAB_STYLING" | "HUMAN_HANDOFF",
  "extractedHeightCm": number or null,
  "extractedBustInches": number or null,
  "fitPreference": "fitted" | "regular" | "loose" | "extra_loose" | null,
  "lengthAdjustmentInches": number or null,
  "sleeveAdjustmentInches": number or null,
  "sleeveStyle": "string or null",
  "customRequests": ["array of notes or add-ons e.g. 'Feeding Zip', 'Hidden Side Pockets'"],
  "occasion": "string or null",
  "customerNotes": "string or null",
  "recommendedSize": number or null,
  "isComplete": boolean,
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
              intent: parsed.intent || undefined,
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

  /**
   * Process a voice note using Gemini's native multimodal audio capabilities
   */
  public async executeVoiceTurn(input: {
    audioBase64: string;
    mimeType: string;
    chatHistory: Array<{ sender: 'ai' | 'user' | 'senior_designer'; text: string }>;
    currentRecord: any;
    productTitle: string;
    productCategory?: string;
  }): Promise<(FreeAiTurnOutput & { transcribedText?: string }) | null> {
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

      const textInstruction = `
${systemPrompt}

Current Session Measurements Recorded So Far:
${JSON.stringify(input.currentRecord, null, 2)}

Chat History:
${historyText || 'No previous messages'}

### AUDIO VOICE INSTRUCTION:
The customer has spoken a voice message (audio attached).
1. Listen to the audio carefully. The customer may speak in Arabic (Gulf/Khaleeji/Standard), English, Urdu, Hindi, Malayalam, French, or another language.
2. Transcribe the customer's exact words in "transcribedText".
3. Extract any height, bust, fit, length/sleeve adjustments, feeding zip, hidden pockets, or styling questions.
4. Reply in "replyMessage" using the EXACT SAME LANGUAGE and dialect the customer spoke in (e.g. if they spoke Arabic, reply in Arabic; if Urdu/Hindi, reply in Urdu/Hindi; if Malayalam, reply in Malayalam; if English, reply in English).
5. Follow the exact JSON output schema. Return ONLY valid JSON.
`;

      const audioPart = {
        inlineData: {
          data: input.audioBase64,
          mimeType: input.mimeType || 'audio/webm'
        }
      };

      for (const candidate of candidateModels) {
        try {
          const model = client.getGenerativeModel({
            model: candidate,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2
            }
          });

          const result = await model.generateContent([textInstruction, audioPart]);
          const responseText = result.response.text();

          if (responseText) {
            const parsed = JSON.parse(responseText);
            return {
              transcribedText: parsed.transcribedText || "Voice Message",
              replyMessage: parsed.replyMessage || "I've listened to your voice message and updated your bespoke requirements.",
              intent: parsed.intent || undefined,
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
          console.warn(`Gemini voice turn with model ${candidate} failed: ${err.message}, trying next candidate...`);
        }
      }
    }

    return null;
  }
}
