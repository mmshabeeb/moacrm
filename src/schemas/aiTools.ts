/**
 * MOA AI Designer Function Calling Tool Definitions
 * Used by Gemini / OpenAI compatible function calling engine to parse and validate live consultation data.
 */

export const MOA_AI_TOOLS = [
  {
    name: "extract_and_update_customisation",
    description: "Extracts customer measurements, size preferences, and bespoke alteration requests from the conversation turn and updates the structured customisation state.",
    parameters: {
      type: "object",
      properties: {
        height_value: {
          type: "number",
          description: "Numerical height value provided by customer."
        },
        height_unit: {
          type: "string",
          enum: ["cm", "ft", "inches"],
          description: "Unit of height measurement."
        },
        bust_inches: {
          type: "number",
          description: "Full circumference bust measurement in inches (or converted to inches)."
        },
        waist_inches: {
          type: "number",
          description: "Natural waist measurement in inches."
        },
        hips_inches: {
          type: "number",
          description: "Hips measurement in inches."
        },
        fit_preference: {
          type: "string",
          enum: ["fitted", "regular", "loose", "extra_loose"],
          description: "Customer's desired ease/silhouette fit."
        },
        desired_length_adjustment_inches: {
          type: "number",
          description: "Length alteration in inches (positive for longer, negative for shorter, e.g. +2 or -1.5)."
        },
        desired_sleeve_adjustment_inches: {
          type: "number",
          description: "Sleeve alteration in inches (positive for longer, negative for shorter)."
        },
        sleeve_style_preference: {
          type: "string",
          description: "e.g. 'extra loose around arms', 'elastic wrist', 'button cuff'."
        },
        special_requests: {
          type: "array",
          items: { type: "string" },
          description: "Any bespoke additions like side pockets, snap buttons, inner belt, etc."
        }
      }
    }
  },
  {
    name: "request_senior_designer_handoff",
    description: "Escalates the session to a Senior Human Designer when measurements are contradictory, bespoke alterations exceed safe bounds, or customer expresses dissatisfaction/requests human help.",
    parameters: {
      type: "object",
      properties: {
        trigger_reason: {
          type: "string",
          enum: [
            "CONTRADICTORY_MEASUREMENTS",
            "BESPOKE_OUT_OF_BOUNDS",
            "CUSTOMER_EXPLICIT_REQUEST",
            "LOW_AI_CONFIDENCE",
            "DISSATISFACTION_DETECTED"
          ]
        },
        detailed_explanation: {
          type: "string",
          description: "Concise summary for the senior designer explaining why escalation occurred and what specific advice is needed."
        }
      },
      required: ["trigger_reason", "detailed_explanation"]
    }
  },
  {
    name: "present_customisation_verification_card",
    description: "Triggers the final confirmation card in the chat widget when all mandatory specifications for the product category are gathered and validated.",
    parameters: {
      type: "object",
      properties: {
        recommended_size: { type: "number" },
        summary_bullets: {
          type: "array",
          items: { type: "string" },
          description: "Bullet points summarizing Height, Bust, Fit, Adjustments, and Notes."
        },
        requires_extra_charge: { type: "boolean" },
        extra_charge_amount: { type: "number" }
      },
      required: ["recommended_size", "summary_bullets"]
    }
  }
];
