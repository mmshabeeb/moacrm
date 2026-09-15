import { MOASizingEngine } from './sizingEngine';
import { FreeAiModelService } from './freeAiModelService';
import productCategoriesData from '../rules/productCategories.json';
import { 
  AIConversationState, 
  CustomisationStatus, 
  StructuredCustomisationRecord,
  MOA_SENIOR_HANDOFF_MESSAGE 
} from '../models/customisation';

export interface ChatMessage {
  sender: 'ai' | 'user' | 'senior_designer';
  text: string;
  timestamp: string;
}

export interface ConversationTurnResult {
  replyMessage: string;
  updatedState: AIConversationState;
  customisationStatus: CustomisationStatus;
  updatedRecord: Partial<StructuredCustomisationRecord>;
  showVerificationCard: boolean;
  verificationSummary?: {
    recommendedSize: number;
    height: string;
    bust: string;
    waist?: string;
    fit: string;
    lengthAdjustment: string;
    sleeveAdjustment: string;
    specialNotes: string;
  };
  escalationTriggered: boolean;
  escalationReason?: string;
}

export class MOAAIConversationEngine {
  private sizingEngine: MOASizingEngine;
  private freeAiService: FreeAiModelService;

  constructor() {
    this.sizingEngine = new MOASizingEngine();
    this.freeAiService = new FreeAiModelService();
  }

  /**
   * System Prompt for MOA AI Designer Persona
   */
  public getSystemPrompt(productTitle: string, categoryId: string = 'abaya_standard'): string {
    return this.freeAiService.getTrainedSystemPrompt(productTitle, categoryId);
  }

  /**
   * Process a conversational turn with Free AI LLM + deterministic verification
   */
  public async processTurn(params: {
    userMessage: string;
    history: ChatMessage[];
    currentRecord: Partial<StructuredCustomisationRecord>;
    productTitle: string;
    productCategory?: string;
  }): Promise<ConversationTurnResult> {
    const { userMessage, history, currentRecord, productTitle, productCategory = 'abaya_standard' } = params;
    const text = userMessage.toLowerCase().trim();

    // 0. Reset or Start Over request
    const isReset = /^(reset|start over|clear|new customisation|restart)\s*!?$/i.test(text);
    if (isReset) {
      const resetRecord: Partial<StructuredCustomisationRecord> = {
        id: currentRecord.id || `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`,
        product_title: productTitle,
        fit_preference: 'regular',
        state: 'AI_HANDLING',
        customisation_status: 'GATHERING',
        customer_confirmed: false,
        requires_extra_charge: false
      };
      return {
        replyMessage: `Salam! I've cleared your previous entries so we can start fresh for **${productTitle}**. May I know your **height** to begin?`,
        updatedState: 'AI_HANDLING',
        customisationStatus: 'GATHERING',
        updatedRecord: resetRecord,
        showVerificationCard: false,
        escalationTriggered: false
      };
    }

    // 0.1 Pure greeting check (e.g. "hi", "hello", "salam")
    const isPureGreeting = /^(hi|hello|hey|salam|salamualaykum|assalamu alaikum|good morning|good evening|marhaba)\s*!?$/i.test(text);
    if (isPureGreeting) {
      return {
        replyMessage: `Salam! Welcome to Mall of Abayas. It’s lovely to have you here. I'd be delighted to help you find the perfect bespoke fit and customize your **${productTitle}**. May I know your **height** to start?`,
        updatedState: 'AI_HANDLING',
        customisationStatus: 'GATHERING',
        updatedRecord: currentRecord,
        showVerificationCard: false,
        escalationTriggered: false
      };
    }

    // 1. Explicit escalation triggers
    if (text.includes('human') || text.includes('designer') || text.includes('speak to a person') || text.includes('talk to someone')) {
      return {
        replyMessage: MOA_SENIOR_HANDOFF_MESSAGE,
        updatedState: 'HUMAN_DESIGNER_CONNECTED',
        customisationStatus: 'ESCALATED_TO_SENIOR',
        updatedRecord: { ...currentRecord, state: 'HUMAN_DESIGNER_CONNECTED' },
        showVerificationCard: false,
        escalationTriggered: true,
        escalationReason: "Customer explicitly requested senior human designer support."
      };
    }

    // 2. Attempt Free AI Model Execution (Gemini / Groq / Ollama)
    try {
      const aiResult = await this.freeAiService.executeTurn({
        userMessage,
        chatHistory: history,
        currentRecord,
        productTitle,
        productCategory
      });

      if (aiResult) {
        // Merge extracted values
        const mergedCustomRequests = Array.from(new Set([
          ...(currentRecord.custom_requests || []),
          ...(aiResult.customRequests || [])
        ]));

        const updated: Partial<StructuredCustomisationRecord> = {
          ...currentRecord,
          ...(aiResult.extractedHeightCm && { height_cm: aiResult.extractedHeightCm }),
          ...(aiResult.extractedBustInches && { bust_inches: aiResult.extractedBustInches }),
          ...(aiResult.fitPreference && { fit_preference: aiResult.fitPreference }),
          ...(aiResult.lengthAdjustmentInches !== undefined && aiResult.lengthAdjustmentInches !== null && { length_adjustment_inches: aiResult.lengthAdjustmentInches }),
          ...(aiResult.sleeveAdjustmentInches !== undefined && aiResult.sleeveAdjustmentInches !== null && { sleeve_adjustment_inches: aiResult.sleeveAdjustmentInches }),
          ...(aiResult.sleeveStyle && { sleeve_style: aiResult.sleeveStyle }),
          ...(mergedCustomRequests.length > 0 && { custom_requests: mergedCustomRequests })
        };

        // Recalculate recommendation using trained matrix
        const recommendation = this.sizingEngine.recommendSize({
          height_cm: updated.height_cm,
          bust_inches: updated.bust_inches,
          fit_preference: updated.fit_preference
        });
        updated.recommended_size = recommendation.standard_size;

        // Check boundaries
        const validation = this.sizingEngine.validateAlterations(
          updated.length_adjustment_inches,
          updated.sleeve_adjustment_inches
        );

        if (aiResult.requiresEscalation || validation.requiresSeniorReview) {
          return {
            replyMessage: `${validation.issues.join(' ')} ${MOA_SENIOR_HANDOFF_MESSAGE}`,
            updatedState: 'HUMAN_REVIEW_REQUIRED',
            customisationStatus: 'ESCALATED_TO_SENIOR',
            updatedRecord: updated,
            showVerificationCard: false,
            escalationTriggered: true,
            escalationReason: aiResult.escalationReason || validation.issues.join('; ')
          };
        }

        const isComplete = (aiResult.isComplete || (!!updated.height_cm && !!updated.bust_inches));
        if (isComplete) {
          const fitLabel = updated.fit_preference ? updated.fit_preference.replace('_', ' ').toUpperCase() : 'REGULAR';
          const lenAdj = updated.length_adjustment_inches ? `${updated.length_adjustment_inches > 0 ? '+' : ''}${updated.length_adjustment_inches}"` : 'Standard Length';
          const sleeveAdj = updated.sleeve_adjustment_inches ? `${updated.sleeve_adjustment_inches > 0 ? '+' : ''}${updated.sleeve_adjustment_inches}"` : (updated.sleeve_style || 'Standard');

          return {
            replyMessage: aiResult.replyMessage,
            updatedState: 'AI_HANDLING',
            customisationStatus: 'READY_FOR_VERIFICATION',
            updatedRecord: updated,
            showVerificationCard: true,
            verificationSummary: {
              recommendedSize: recommendation.standard_size,
              height: `${updated.height_cm} cm`,
              bust: `${updated.bust_inches}"`,
              fit: fitLabel,
              lengthAdjustment: lenAdj,
              sleeveAdjustment: sleeveAdj,
              specialNotes: updated.sleeve_style || (updated.custom_requests ? updated.custom_requests.join(', ') : 'None'),
              addOns: updated.custom_requests || []
            } as any,
            escalationTriggered: false
          };
        }

        return {
          replyMessage: aiResult.replyMessage,
          updatedState: 'AI_HANDLING',
          customisationStatus: 'GATHERING',
          updatedRecord: updated,
          showVerificationCard: false,
          escalationTriggered: false
        };
      }
    } catch (err) {
      console.warn('AI Model invocation handled; switching to rule engine:', err);
    }

    // 3. Deterministic Trained NLP Fallback Engine
    const extracted: Partial<StructuredCustomisationRecord> = { ...currentRecord };

    // Height extraction (e.g. 165 cm, 165cm, 5.4 ft, 5'6")
    const cmMatch = text.match(/(\d{3})\s*(?:cm|centimeters)?/);
    if (cmMatch) {
      extracted.height_cm = parseInt(cmMatch[1], 10);
    }

    const ftMatch = text.match(/(?:5|6)['.]\s*(\d{1,2})?|(\d(?:\.\d)?)\s*(?:ft|feet)/);
    if (ftMatch && !extracted.height_cm) {
      if (text.includes("5'6") || text.includes("5.6")) extracted.height_cm = 170;
      else if (text.includes("5'4") || text.includes("5.4")) extracted.height_cm = 164;
      else if (text.includes("5'2") || text.includes("5.2")) extracted.height_cm = 158;
      else if (text.includes("5'0") || text.includes("5.0")) extracted.height_cm = 153;
      else if (text.includes("5'5") || text.includes("5.5")) extracted.height_cm = 167;
      else if (text.includes("5'7") || text.includes("5.7")) extracted.height_cm = 173;
      else if (text.includes("5'8") || text.includes("5.8")) extracted.height_cm = 176;
    }

    // Bust extraction (e.g. bust is 38, bust 38", 38 bust)
    const bustMatch = text.match(/(?:bust|chest)\s*(?:is|:)?\s*(\d{2})\s*(?:inch|inches|in|")?/i) ||
                      text.match(/(\d{2})\s*(?:inch|inches|in|")?\s*(?:bust|chest)/i);
    if (bustMatch) {
      extracted.bust_inches = parseInt(bustMatch[1], 10);
    }

    // Fit preference
    if (text.includes('extra loose') || text.includes('very loose') || text.includes('oversized')) {
      extracted.fit_preference = 'extra_loose';
    } else if (text.includes('loose') || text.includes('relaxed')) {
      extracted.fit_preference = 'loose';
    } else if (text.includes('fitted') || text.includes('close fit')) {
      extracted.fit_preference = 'fitted';
    } else if (!extracted.fit_preference) {
      extracted.fit_preference = 'regular';
    }

    // Sleeve adjustment
    const sleeveMatch = text.match(/(?:sleeve|sleeves|arms?)\s*(?:is|by|\+|\-)?\s*(\d+)\s*(?:inch|inches|in|")?/i) ||
                        text.match(/(\d+)\s*(?:inch|inches|in|")?\s*(?:longer|shorter|extra)?\s*(?:sleeve|sleeves|arms?)/i) ||
                        text.match(/(?:sleeve|sleeves|arms?)\s*(?:longer|shorter)?\s*(\d+)\s*(?:inch|inches|in|")?/i);
    if (sleeveMatch) {
      const val = parseInt(sleeveMatch[1], 10);
      extracted.sleeve_adjustment_inches = text.includes('short') ? -val : val;
    }

    if (text.includes('room around arms') || text.includes('loose sleeve') || text.includes('wider sleeve')) {
      extracted.sleeve_style = "Extra room around arms / loose drape";
    }

    // Length adjustment
    const lengthMatch = text.match(/(?:length|abaya|garment)\s*(?:is|by|\+|\-)?\s*(\d+)\s*(?:inch|inches|in|")?/i) ||
                        text.match(/(\d+)\s*(?:inch|inches|in|")?\s*(?:longer|shorter|extra)?\s*(?:length|abaya|garment)/i);
    if (lengthMatch) {
      const val = parseInt(lengthMatch[1], 10);
      extracted.length_adjustment_inches = (text.includes('short') || text.includes('not touching')) ? -val : val;
    } else if (text.includes('not touching the floor') || text.includes('slightly shorter')) {
      extracted.length_adjustment_inches = -1;
    }

    // Sizing recommendation & validation
    const recommendation = this.sizingEngine.recommendSize({
      height_cm: extracted.height_cm,
      bust_inches: extracted.bust_inches,
      fit_preference: extracted.fit_preference
    });

    extracted.recommended_size = recommendation.standard_size;

    // Validate customisation boundaries
    const validation = this.sizingEngine.validateAlterations(
      extracted.length_adjustment_inches,
      extracted.sleeve_adjustment_inches
    );

    if (validation.requiresSeniorReview) {
      return {
        replyMessage: `${validation.issues.join(' ')} ${MOA_SENIOR_HANDOFF_MESSAGE}`,
        updatedState: 'HUMAN_REVIEW_REQUIRED',
        customisationStatus: 'ESCALATED_TO_SENIOR',
        updatedRecord: extracted,
        showVerificationCard: false,
        escalationTriggered: true,
        escalationReason: validation.issues.join('; ')
      };
    }

    // Completion Check: Have we collected all required parameters?
    const hasHeight = !!extracted.height_cm;
    const hasBust = !!extracted.bust_inches;

    // Detect specific alteration inquiries in text
    let addonAck = '';
    if (text.includes('feeding') || text.includes('zip') || text.includes('maternity')) {
      addonAck = 'Yes, certainly! We can add concealed front maternity/feeding zippers for you complimentary. ';
      if (!extracted.custom_requests) extracted.custom_requests = [];
      if (!extracted.custom_requests.includes('Feeding Zip')) extracted.custom_requests.push('Feeding Zip');
    } else if (text.includes('pocket')) {
      addonAck = 'Yes, certainly! We can add two deep concealed side pockets to the drape. ';
      if (!extracted.custom_requests) extracted.custom_requests = [];
      if (!extracted.custom_requests.includes('Hidden Side Pockets')) extracted.custom_requests.push('Hidden Side Pockets');
    }

    if (hasHeight && hasBust) {
      const fitLabel = extracted.fit_preference ? extracted.fit_preference.replace('_', ' ').toUpperCase() : 'REGULAR';
      const lenAdj = extracted.length_adjustment_inches ? `${extracted.length_adjustment_inches > 0 ? '+' : ''}${extracted.length_adjustment_inches}"` : 'Standard Length';
      const sleeveAdj = extracted.sleeve_adjustment_inches ? `${extracted.sleeve_adjustment_inches > 0 ? '+' : ''}${extracted.sleeve_adjustment_inches}"` : (extracted.sleeve_style || 'Standard');

      return {
        replyMessage: `${addonAck}I've updated your bespoke tailoring specifications for **${productTitle}**. Based on your height (${extracted.height_cm} cm), your baseline is **Size ${recommendation.standard_size}** with ${fitLabel} drape. Please review the summary card below and tap confirm when you are ready.`,
        updatedState: 'AI_HANDLING',
        customisationStatus: 'READY_FOR_VERIFICATION',
        updatedRecord: extracted,
        showVerificationCard: true,
        verificationSummary: {
          recommendedSize: recommendation.standard_size,
          height: `${extracted.height_cm} cm`,
          bust: `${extracted.bust_inches}"`,
          fit: fitLabel,
          lengthAdjustment: lenAdj,
          sleeveAdjustment: sleeveAdj,
          specialNotes: extracted.sleeve_style || (extracted.custom_requests ? extracted.custom_requests.join(', ') : 'None'),
          addOns: extracted.custom_requests || []
        } as any,
        escalationTriggered: false
      };
    }

    if (!hasHeight && !hasBust) {
      return {
        replyMessage: `${addonAck}Salam! Welcome to Mall of Abayas. I'm here to help tailor your **${productTitle}** with your perfect bespoke fit. To begin, could you please share your **height** (in cm or ft/in) and your usual **bust measurement** or fit preference?`,
        updatedState: 'AI_HANDLING',
        customisationStatus: 'GATHERING',
        updatedRecord: extracted,
        showVerificationCard: false,
        escalationTriggered: false
      };
    }

    if (!hasHeight) {
      return {
        replyMessage: `${addonAck}Got it! I have noted your bust measurement (${extracted.bust_inches}"). What is your **height**, so I can match the perfect length and proportion for you?`,
        updatedState: 'AI_HANDLING',
        customisationStatus: 'GATHERING',
        updatedRecord: extracted,
        showVerificationCard: false,
        escalationTriggered: false
      };
    }

    return {
      replyMessage: `${addonAck}Thank you! At ${extracted.height_cm} cm, your standard size reference is **Size ${recommendation.standard_size}**. What is your **bust measurement** (in inches or cm), and do you prefer a regular or extra loose modest fit?`,
      updatedState: 'AI_HANDLING',
      customisationStatus: 'GATHERING',
      updatedRecord: extracted,
      showVerificationCard: false,
      escalationTriggered: false
    };
  }
}
