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
export const activeSessions = new Map<string, {
  record: Partial<StructuredCustomisationRecord>;
  history: any[];
  productTitle: string;
  productCategory: string;
}>();

/**
 * POST /api/chat/customer-info
 * Capture customer identity (Name, Mobile/WhatsApp, Email) on PDP customisation toggle
 */
chatRouter.post('/customer-info', (req: Request, res: Response) => {
  try {
    const { sessionToken, customerName, customerPhone, customerEmail, customerId, productTitle, productCategory } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'Missing sessionToken' });
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

    if (customerName) session.record.customer_name = customerName;
    if (customerPhone) session.record.customer_phone = customerPhone;
    if (customerEmail) session.record.customer_email = customerEmail;
    if (customerId) session.record.customer_id = customerId;

    return res.json({
      success: true,
      customisationId: session.record.id,
      customer: {
        name: session.record.customer_name,
        phone: session.record.customer_phone,
        email: session.record.customer_email,
        id: session.record.customer_id
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update customer info' });
  }
});

/**
 * POST /api/chat/message
 * Handles incoming conversational turns from the Shopify PDP
 */
chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { sessionToken, userMessage, productTitle, productCategory, customerInfo, customerName, customerPhone, customerEmail, customerId } = req.body;

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

    // Attach customer identity
    const cName = customerName || customerInfo?.name;
    const cPhone = customerPhone || customerInfo?.phone;
    const cEmail = customerEmail || customerInfo?.email;
    const cId = customerId || customerInfo?.id;

    if (cName) session.record.customer_name = cName;
    if (cPhone) session.record.customer_phone = cPhone;
    if (cEmail) session.record.customer_email = cEmail;
    if (cId) session.record.customer_id = cId;

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
 * POST /api/chat/voice-message
 * Handles WhatsApp-style incoming customer voice notes from the Shopify PDP
 */
chatRouter.post('/voice-message', async (req: Request, res: Response) => {
  try {
    const { sessionToken, audioBase64, mimeType, productTitle, productCategory, customerInfo, customerName, customerPhone, customerEmail, customerId } = req.body;

    if (!sessionToken || !audioBase64) {
      return res.status(400).json({ error: 'Missing sessionToken or audioBase64' });
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

    // Attach customer identity
    const cName = customerName || customerInfo?.name;
    const cPhone = customerPhone || customerInfo?.phone;
    const cEmail = customerEmail || customerInfo?.email;
    const cId = customerId || customerInfo?.id;

    if (cName) session.record.customer_name = cName;
    if (cPhone) session.record.customer_phone = cPhone;
    if (cEmail) session.record.customer_email = cEmail;
    if (cId) session.record.customer_id = cId;

    // Process Voice Note with Gemini Multimodal Audio
    const turnResult = await aiEngine.processVoiceTurn({
      audioBase64,
      mimeType: mimeType || 'audio/webm',
      history: session.history,
      currentRecord: session.record,
      productTitle: session.productTitle,
      productCategory: session.productCategory
    });

    const userLabel = turnResult.transcribedText ? `🎙️ Voice: "${turnResult.transcribedText}"` : '🎙️ Voice Note';

    // Add user voice message to history
    session.history.push({
      sender: 'user',
      text: userLabel,
      audioBase64: `data:${mimeType || 'audio/webm'};base64,${audioBase64}`,
      transcribedText: turnResult.transcribedText,
      timestamp: new Date().toISOString()
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
        customer_name: session.record.customer_name,
        customer_contact: session.record.customer_phone || session.record.customer_email,
        customer_phone: session.record.customer_phone,
        customer_email: session.record.customer_email,
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
      transcribedText: turnResult.transcribedText,
      replyMessage: turnResult.replyMessage,
      state: turnResult.updatedState,
      status: turnResult.customisationStatus,
      showVerificationCard: turnResult.showVerificationCard,
      verificationSummary: turnResult.verificationSummary
    });
  } catch (error: any) {
    console.error('Voice turn error:', error);
    return res.status(500).json({ error: 'Failed to process voice note consultation' });
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
      customerName: session.record.customer_name,
      customerPhone: session.record.customer_phone,
      message: 'Customisation confirmed successfully. Add to cart unlocked.',
      lineItemProperties: {
        '_moa_customisation_id': session.record.id,
        'Customisation Customer': session.record.customer_name || 'Guest',
        'Customisation Phone': session.record.customer_phone || '',
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
 * GET /api/chat/sessions
 * Returns all active customer storefront chat sessions for CRM live monitoring
 */
chatRouter.get('/sessions', (req: Request, res: Response) => {
  try {
    const sessionsList = Array.from(activeSessions.entries()).map(([token, session]) => {
      const lastMsg = session.history[session.history.length - 1];
      const preview = lastMsg ? lastMsg.text : 'Customer started consultation';
      const lastTime = lastMsg?.timestamp ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Just now';
      
      const record = session.record || {};
      const isEscalated = record.state === 'HUMAN_DESIGNER_CONNECTED' || record.state === 'HUMAN_REVIEW_REQUIRED';
      const isClaimed = !!record.claimed_by_id;

      const customerDisplayName = record.customer_name 
        ? `${record.customer_name}` 
        : `Customer (${session.productTitle ? session.productTitle.slice(0, 20) : 'Abaya Shopper'})`;

      const cleanPhone = (record.customer_phone || '').replace(/[^\d+]/g, '');
      const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : null;

      return {
        id: record.id || token,
        sessionToken: token,
        name: customerDisplayName,
        customerName: record.customer_name || null,
        customerPhone: record.customer_phone || null,
        customerEmail: record.customer_email || null,
        customerId: record.customer_id || null,
        whatsappUrl: whatsappUrl,
        orderNumber: `#${record.id ? record.id.replace('MOA-CUS-', '') : 'PDP'}`,
        avatar: '👗',
        avatarColor: '#00a884',
        product: session.productTitle,
        baseSize: record.recommended_size ? `${record.recommended_size}` : 'Pending',
        height: record.height_cm ? `${record.height_cm} cm` : 'Not provided',
        bust: record.bust_inches ? `${record.bust_inches}"` : 'Not provided',
        fit: (record.fit_preference || 'regular').toUpperCase(),
        sleeve: record.sleeve_adjustment_inches ? `${record.sleeve_adjustment_inches > 0 ? '+' : ''}${record.sleeve_adjustment_inches}"` : (record.sleeve_style || 'Standard'),
        length: record.length_adjustment_inches ? `${record.length_adjustment_inches > 0 ? '+' : ''}${record.length_adjustment_inches}"` : 'Standard',
        status: isClaimed ? `online • claimed by ${record.claimed_by_name}` : (isEscalated ? 'online • waiting in unassigned queue' : 'online • chatting with AI Designer on PDP'),
        time: lastTime,
        preview: preview,
        unread: 1,
        claimedBy: record.claimed_by_name || null,
        claimedById: record.claimed_by_id || null,
        claimedByRole: record.claimed_by_role || null,
        isAIHandling: !isEscalated && !isClaimed,
        messages: session.history.map(m => ({
          type: 'text',
          incoming: m.sender === 'user',
          author: m.sender === 'user' ? (record.customer_name || 'Customer') : (m.sender === 'senior_designer' ? (record.claimed_by_name || 'Senior Designer') : 'MOA AI Designer'),
          text: m.text,
          time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : 'Just now',
          ticks: m.sender === 'ai' ? '✓✓' : undefined
        }))
      };
    });

    return res.json({ success: true, sessions: sessionsList });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * POST /api/chat/designer-message
 * Staff / Senior Designer sends a direct message to a storefront customer
 */
chatRouter.post('/designer-message', (req: Request, res: Response) => {
  try {
    const { sessionId, sessionToken, message, designerName, designerId } = req.body;
    const targetToken = sessionToken || sessionId;

    let targetSession = activeSessions.get(targetToken);
    if (!targetSession) {
      // Look up by record.id
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.record.id === targetToken || tok === targetToken) {
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      return res.status(404).json({ error: 'Session not found' });
    }

    targetSession.history.push({
      sender: 'senior_designer',
      text: message,
      timestamp: new Date().toISOString()
    });

    targetSession.record.state = 'HUMAN_DESIGNER_CONNECTED';
    if (designerName) targetSession.record.claimed_by_name = designerName;
    if (designerId) targetSession.record.claimed_by_id = designerId;

    return res.json({ success: true, message: 'Message delivered to storefront' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to deliver designer message' });
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

/**
 * GET /api/chat/sync/:sessionToken
 * Polls latest chat history and designer state from storefront PDP widget
 */
chatRouter.get('/sync/:sessionToken', (req: Request, res: Response) => {
  try {
    const { sessionToken } = req.params;
    let targetSession = activeSessions.get(sessionToken);

    if (!targetSession) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.record.id === sessionToken || tok === sessionToken) {
          targetSession = sess;
          break;
        }
      }
    }

    if (!targetSession) {
      return res.json({ success: true, history: [], state: 'AI_HANDLING', isHumanHandling: false });
    }

    const isHuman = targetSession.record.state === 'HUMAN_DESIGNER_CONNECTED' || !!targetSession.record.claimed_by_id;

    return res.json({
      success: true,
      customisationId: targetSession.record.id,
      state: targetSession.record.state,
      isHumanHandling: isHuman,
      claimedByName: targetSession.record.claimed_by_name || 'Senior Atelier Designer',
      history: targetSession.history,
      record: targetSession.record
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to sync chat' });
  }
});

/**
 * POST /api/chat/takeover
 * Transitions a session from AI handling to Human Senior Designer
 */
chatRouter.post('/takeover', (req: Request, res: Response) => {
  try {
    const { sessionId, sessionToken, designerName, designerId, designerRole } = req.body;
    const targetToken = sessionToken || sessionId;

    let targetSession = activeSessions.get(targetToken);
    if (!targetSession) {
      for (const [tok, sess] of activeSessions.entries()) {
        if (sess.record.id === targetToken || tok === targetToken) {
          targetSession = sess;
          break;
        }
      }
    }

    if (targetSession) {
      targetSession.record.state = 'HUMAN_DESIGNER_CONNECTED';
      targetSession.record.claimed_by_name = designerName || 'Senior Designer';
      targetSession.record.claimed_by_id = designerId || 'user_designer_1';
      targetSession.record.claimed_by_role = designerRole || 'SENIOR_DESIGNER';

      targetSession.history.push({
        sender: 'senior_designer',
        text: `Salam! I am ${designerName || 'Senior Atelier Designer'} from the MOA customisation team. I am now reviewing your measurements and bespoke requests.`,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({ success: true, message: 'Session transitioned to human designer' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to take over session' });
  }
});

/**
 * POST /api/chat/reset-demo-data
 * Completely purges all demo sessions, mock orders, and resets CRM to 100% clean state
 */
chatRouter.post('/reset-demo-data', (req: Request, res: Response) => {
  try {
    activeSessions.clear();
    return res.json({ success: true, message: 'All demo chat sessions cleared successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reset demo data' });
  }
});

