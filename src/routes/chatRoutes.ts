import { Router, Request, Response } from 'express';
import { MOAAIConversationEngine } from '../services/aiConversationEngine';
import { MOACrmAdapter } from '../services/moaCrmAdapter';
import { MOASizingEngine } from '../services/sizingEngine';
import { StructuredCustomisationRecord } from '../models/customisation';

export const chatRouter = Router();
const aiEngine = new MOAAIConversationEngine();
const sizingEngine = new MOASizingEngine();
const crmAdapter = new MOACrmAdapter({ baseUrl: process.env.MOA_CRM_BASE_URL || 'http://localhost:4000' });

// In-memory session store (synced to DB in full environment)
const activeSessions = new Map<string, {
  record: Partial<StructuredCustomisationRecord>;
  history: any[];
  productTitle: string;
  productCategory: string;
}>();

/**
 * POST /api/chat/message
 * Handles incoming conversational turns from the Shopify PDP
 */
chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { sessionToken, userMessage, productTitle, productCategory } = req.body;

    if (!sessionToken || !userMessage) {
      return res.status(400).json({ error: 'Missing sessionToken or userMessage' });
    }

    let session = activeSessions.get(sessionToken);
    if (!session) {
      session = {
        record: {
          id: `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`,
          product_title: productTitle || 'Mall of Abayas Product',
          fit_preference: 'regular',
          state: 'AI_HANDLING',
          customisation_status: 'GATHERING',
          customer_confirmed: false,
          requires_extra_charge: false
        },
        history: [],
        productTitle: productTitle || 'Mall of Abayas Product',
        productCategory: productCategory || 'abaya_standard'
      };
      activeSessions.set(sessionToken, session);
    }

    // Add user message to history
    session.history.push({
      sender: 'user',
      text: userMessage,
      timestamp: new Date().toISOString()
    });

    // Run AI turn
    const turnResult = await aiEngine.processTurn({
      userMessage,
      history: session.history,
      currentRecord: session.record,
      productTitle: session.productTitle,
      productCategory: session.productCategory
    });

    // Update session record
    session.record = { ...session.record, ...turnResult.updatedRecord };

    // Record AI response to history
    session.history.push({
      sender: turnResult.escalationTriggered ? 'senior_designer' : 'ai',
      text: turnResult.replyMessage,
      timestamp: new Date().toISOString()
    });

    // If escalation triggered, dispatch dossier to MOA CRM
    if (turnResult.escalationTriggered) {
      await crmAdapter.escalateToDesigner({
        session_id: session.record.id || sessionToken,
        product_title: session.productTitle,
        current_recommended_size: session.record.recommended_size,
        measurements_summary: {
          height: session.record.height_cm ? `${session.record.height_cm} cm` : undefined,
          bust: session.record.bust_inches ? `${session.record.bust_inches}"` : undefined
        },
        requested_alterations: session.record.custom_requests || [],
        escalation_trigger: 'BESPOKE_OUT_OF_BOUNDS',
        reason_for_escalation: turnResult.escalationReason || 'Custom tailoring review required',
        chat_history: session.history
      });
    }

    return res.json({
      success: true,
      customisationId: session.record.id,
      replyMessage: turnResult.replyMessage,
      state: turnResult.updatedState,
      status: turnResult.customisationStatus,
      showVerificationCard: turnResult.showVerificationCard,
      verificationSummary: turnResult.verificationSummary
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to process consultation turn' });
  }
});

/**
 * POST /api/chat/confirm
 * Customer explicitly clicks "Confirm My Customisation"
 */
chatRouter.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.body;
    const session = activeSessions.get(sessionToken);

    if (!session || !session.record) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.record.customer_confirmed = true;
    session.record.confirmed_at = new Date().toISOString();
    session.record.customisation_status = 'CUSTOMER_CONFIRMED';

    // Synchronize to MOA CRM
    await crmAdapter.syncConfirmedCustomisation(session.record as StructuredCustomisationRecord);

    return res.json({
      success: true,
      customisationId: session.record.id,
      message: 'Customisation confirmed successfully. Add to cart unlocked.',
      lineItemProperties: {
        '_moa_customisation_id': session.record.id,
        'Customisation Fit': session.record.fit_preference?.toUpperCase(),
        'Customisation Height': `${session.record.height_cm} cm`,
        'Customisation Bust': `${session.record.bust_inches}"`,
        'Customisation Length': session.record.length_adjustment_inches ? `${session.record.length_adjustment_inches}"` : 'Standard',
        'Customisation Sleeve': session.record.sleeve_adjustment_inches ? `${session.record.sleeve_adjustment_inches}"` : 'Standard',
        'Customisation Notes': session.record.sleeve_style || 'None'
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to confirm customisation' });
  }
});

/**
 * POST /api/chat/reset
 * Explicitly reset a customer's consultation session to a fresh state
 */
chatRouter.post('/reset', (req: Request, res: Response) => {
  try {
    const { sessionToken, productTitle, productCategory } = req.body;
    if (sessionToken) {
      activeSessions.set(sessionToken, {
        record: {
          id: `MOA-CUS-${Math.floor(100000 + Math.random() * 900000)}`,
          product_title: productTitle || 'Mall of Abayas Product',
          fit_preference: 'regular',
          state: 'AI_HANDLING',
          customisation_status: 'GATHERING',
          customer_confirmed: false,
          requires_extra_charge: false
        },
        history: [],
        productTitle: productTitle || 'Mall of Abayas Product',
        productCategory: productCategory || 'abaya_standard'
      });
    }
    return res.json({ success: true, message: 'Session reset successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reset session' });
  }
});
