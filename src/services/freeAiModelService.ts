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
   * all MOA sizing matrix, tailoring rules, brand tone, and escalation guidelines.
   */
  public getTrainedSystemPrompt(productTitle: string, categoryId: string = 'abaya_standard'): string {
    const category = productCategoriesData.categories.find(c => c.id === categoryId) || productCategoriesData.categories[0];
    
    return `
You are the Senior AI Bespoke Customisation Designer at Mall of Abayas (MOA), Dubai's premier luxury abaya atelier.
You are currently helping a customer on the product detail page for "${productTitle}" (${category.display_name}).

### BRAND IDENTITY & TONE:
- Tone: Warm, courteous, modest fashion authority, polite, and luxury atelier feel.
- Use traditional warm greetings ("Salam!", "Marhaba!", "Wa alaykum assalam").
- Provide clear, reassuring guidance on sizing, draping, and alterations.

### TRAINED KNOWLEDGE BASE & SIZING MATRIX:
${JSON.stringify(sizeMatrixData, null, 2)}

### PRODUCT CATEGORIES & REQUIRED MEASUREMENTS:
Category: ${category.display_name}
Mandatory Measurements Required: ${category.required_measurements.join(', ')}

### AVAILABLE ADD-ONS & CUSTOMISATION OPTIONS:
${JSON.stringify(addonsData.addons, null, 2)}

### ALTERATION BOUNDARIES & POLICIES:
1. Standard Base Size selection:
   - Height 153cm (5'0") -> Size 52 (Length 52", Bust 42")
   - Height 155cm (5'1") -> Size 53 (Length 53", Bust 42")
   - Height 158cm (5'2") -> Size 54 (Length 54", Bust 44")
   - Height 161cm (5'3") -> Size 55 (Length 55", Bust 44")
   - Height 164cm (5'4") -> Size 56 (Length 56", Bust 46")
   - Height 167cm (5'5") -> Size 57 (Length 57", Bust 46")
   - Height 170cm (5'6") -> Size 58 (Length 58", Bust 48")
   - Height 173cm (5'7") -> Size 59 (Length 59", Bust 48")
   - Height 176cm (5'8"+) -> Size 60 (Length 60", Bust 50")
2. Bust & Fit Preference:
   - Fitted: +2" ease
   - Regular: +4" ease
   - Loose: +6" ease
   - Extra Loose: +8" ease
3. Alteration limits:
   - Length adjustment: Allowed between -6 inches and +6 inches.
   - Sleeve adjustment: Allowed between -4 inches and +4 inches.
   - Exceeding these limits REQUIRES escalation to the Senior Human Designer.
4. Escalation Trigger:
   - If customer asks to speak with a human or requests non-standard complex tailoring, set requiresEscalation: true and use escalation message: "${MOA_SENIOR_HANDOFF_MESSAGE}".

### INSTRUCTIONS FOR OUTPUT:
Always analyze the conversation and user message, extract any measurements provided, calculate the recommended size, and return ONLY a valid JSON object matching this schema:
{
  "replyMessage": "Your conversational response to the customer",
  "extractedHeightCm": number or null,
  "extractedBustInches": number or null,
  "fitPreference": "fitted" | "regular" | "loose" | "extra_loose" | null,
  "lengthAdjustmentInches": number or null,
  "sleeveAdjustmentInches": number or null,
  "sleeveStyle": "string or null",
  "customRequests": ["array of notes or requested add-ons"],
  "recommendedSize": number or null,
  "isComplete": boolean (true ONLY when all mandatory measurements like height and bust are provided and validated),
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
    const groqKey = process.env.GROQ_API_KEY;
    const ollamaUrl = process.env.OLLAMA_BASE_URL;

    // 1. If Google Gemini free API is configured
    if (geminiKey) {
      try {
        const client = this.geminiClient || new GoogleGenerativeAI(geminiKey);
        const model = client.getGenerativeModel({
          model: this.modelName || 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });

        const systemPrompt = this.getTrainedSystemPrompt(input.productTitle, input.productCategory);
        const historyText = input.chatHistory.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n');
        
        const prompt = `
System Knowledge & Rules:
${systemPrompt}

Current Session Measurements Recorded So Far:
${JSON.stringify(input.currentRecord)}

Chat History:
${historyText || 'No prior messages'}

User's Latest Message:
"${input.userMessage}"

Respond with ONLY the JSON object format specified in the instructions.
`.trim();

        const response = await model.generateContent(prompt);
        const text = response.response.text();
        const parsed = JSON.parse(text);
        return parsed as FreeAiTurnOutput;
      } catch (err) {
        console.warn('⚠️ Gemini Free AI API call failed or timed out. Falling back gracefully:', err);
      }
    }

    // 2. If Groq Free API is configured (e.g. Llama 3.3 70B Free Tier)
    if (groqKey) {
      try {
        const systemPrompt = this.getTrainedSystemPrompt(input.productTitle, input.productCategory);
        const messages = [
          { role: 'system', content: systemPrompt },
          ...input.chatHistory.map(m => ({
            role: m.sender === 'ai' ? 'assistant' : 'user',
            content: m.text
          })),
          { role: 'user', content: input.userMessage }
        ];

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            messages,
            response_format: { type: 'json_object' },
            temperature: 0.2
          })
        });

        if (res.ok) {
          const data: any = await res.json();
          const parsed = JSON.parse(data.choices[0].message.content);
          return parsed as FreeAiTurnOutput;
        }
      } catch (err) {
        console.warn('⚠️ Groq Free AI call failed:', err);
      }
    }

    // 3. If Ollama local model is configured (100% Free / Local)
    if (ollamaUrl) {
      try {
        const systemPrompt = this.getTrainedSystemPrompt(input.productTitle, input.productCategory);
        const res = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'llama3',
            stream: false,
            format: 'json',
            messages: [
              { role: 'system', content: systemPrompt },
              ...input.chatHistory.map(m => ({
                role: m.sender === 'ai' ? 'assistant' : 'user',
                content: m.text
              })),
              { role: 'user', content: input.userMessage }
            ]
          })
        });

        if (res.ok) {
          const data: any = await res.json();
          const parsed = JSON.parse(data.message.content);
          return parsed as FreeAiTurnOutput;
        }
      } catch (err) {
        console.warn('⚠️ Ollama call failed:', err);
      }
    }

    return null; // Signals fallback to deterministic NLP sizing engine
  }
}
