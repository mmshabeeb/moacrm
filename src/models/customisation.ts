/**
 * Mall of Abayas (MOA) AI Designer - Core Data Models & Schemas
 */

export type AIConversationState = 
  | 'AI_HANDLING'              // 🟢 AI is autonomously managing the consultation
  | 'HUMAN_REVIEW_REQUIRED'    // 🟡 Information gathered or edge-case flagged; requires designer verification
  | 'HUMAN_DESIGNER_CONNECTED';// 🔵 Senior Human Designer has taken over live conversation

export type CustomisationStatus = 
  | 'GATHERING'                // Collecting initial or missing specs
  | 'CLARIFYING'               // Resolving conflicts or non-standard requests
  | 'READY_FOR_VERIFICATION'   // All required specs collected, presenting confirmation card
  | 'CUSTOMER_CONFIRMED'       // Customer explicitly confirmed; Add-to-Cart enabled
  | 'ESCALATED_TO_SENIOR';     // Handed off to human designer

export interface MOASizeRecommendation {
  standard_size: number;              // e.g. 52, 54, 56, 58, 60
  base_length_inches: number;
  base_bust_flat_inches: number;
  base_bust_circumference_inches: number;
  customer_height_cm: number;
  customer_height_ft?: number;
  confidence: number;                 // 0.0 to 1.0
  reasoning: string;
}

export interface StructuredCustomisationRecord {
  id: string;                         // MOA-SESSION-XXXXX
  product_id: string;
  product_title: string;
  variant_id?: string;
  variant_title?: string;
  
  // Baseline sizing & fit
  recommended_size?: number;
  chosen_size?: number;
  fit_preference: 'fitted' | 'regular' | 'loose' | 'extra_loose';
  
  // Measurements
  height_cm?: number;
  bust_inches?: number;
  waist_inches?: number;
  hips_inches?: number;
  
  // Alterations
  length_adjustment_inches?: number;  // e.g. +2 or -1.5
  sleeve_adjustment_inches?: number;  // e.g. +2
  sleeve_style?: string;              // e.g. "Extra room around arms / loose sleeve"
  custom_requests?: string[];         // e.g. ["Extra ease around arms", "Snap buttons added"]
  
  // State & Flags
  state: AIConversationState;
  customisation_status: CustomisationStatus;
  escalation_reason?: string;
  requires_extra_charge: boolean;
  extra_charge_amount?: number;
  
  // Verification
  customer_confirmed: boolean;
  confirmed_at?: string;
  cart_token?: string;
}

export interface EscalationDossier {
  session_id: string;
  customer_name?: string;
  customer_contact?: string;
  product_title: string;
  current_recommended_size?: number;
  measurements_summary: {
    height?: string;
    bust?: string;
    waist?: string;
    hips?: string;
  };
  requested_alterations: string[];
  escalation_trigger: 
    | 'CONTRADICTORY_MEASUREMENTS'
    | 'BESPOKE_OUT_OF_BOUNDS'
    | 'CUSTOMER_EXPLICIT_REQUEST'
    | 'LOW_AI_CONFIDENCE'
    | 'DISSATISFACTION_DETECTED';
  reason_for_escalation: string;
  chat_history: {
    sender: 'customer' | 'ai' | 'senior_designer';
    text: string;
    timestamp: string;
  }[];
}

export const MOA_SENIOR_HANDOFF_MESSAGE = 
  "I want to make sure we get this exactly right for you. I will transfer the chat to my senior designer for further support. Please hold till my senior connects with you.";
