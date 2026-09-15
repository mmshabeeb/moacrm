import { Router, Request, Response } from 'express';
import { MOADesignerRoutingEngine } from '../services/designerRoutingEngine';

export const routingRouter = Router();
export const routingEngine = new MOADesignerRoutingEngine();

/**
 * POST /api/routing/heartbeat
 * Designer presence heartbeat (called every 15s from CRM clients)
 */
routingRouter.post('/heartbeat', (req: Request, res: Response) => {
  try {
    const { designerId, designerName, role, status, maxConcurrentChats, activeChatCount, assignedSessionIds, skills, languages } = req.body;

    if (!designerId || !designerName) {
      return res.status(400).json({ error: 'Missing designer credentials' });
    }

    routingEngine.registerDesignerHeartbeat({
      designerId,
      designerName,
      role: role || 'SENIOR_DESIGNER',
      status: status || 'AVAILABLE',
      maxConcurrentChats: Number(maxConcurrentChats) || 4,
      activeChatCount: Number(activeChatCount) || 0,
      assignedSessionIds: assignedSessionIds || [],
      skills: skills || ['bespoke_tailoring'],
      languages: languages || ['ar', 'en'],
      lastHeartbeat: new Date().toISOString()
    });

    return res.json({ success: true, message: 'Heartbeat registered' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

/**
 * POST /api/routing/takeover
 * Claim or Take Over Chat (Admin/Sub-Admin can take over any active chat; Senior Designer can take over unassigned)
 */
routingRouter.post('/takeover', (req: Request, res: Response) => {
  try {
    const { sessionId, user } = req.body;
    if (!sessionId || !user || !user.id) {
      return res.status(400).json({ error: 'Missing sessionId or user credentials' });
    }

    const result = routingEngine.claimOrTakeoverChat(sessionId, user);
    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to process chat takeover' });
  }
});

/**
 * POST /api/routing/claim (Backward compatibility)
 */
routingRouter.post('/claim', (req: Request, res: Response) => {
  try {
    const { sessionId, designerId } = req.body;
    if (!sessionId || !designerId) {
      return res.status(400).json({ error: 'Missing sessionId or designerId' });
    }

    const result = routingEngine.atomicClaimChat(sessionId, designerId);
    if (!result.success) {
      return res.status(409).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to claim consultation' });
  }
});

/**
 * POST /api/routing/transfer
 * Transfer consultation (Admin can transfer to anyone; Senior Designer only to another designer; or to UNASSIGNED)
 */
routingRouter.post('/transfer', (req: Request, res: Response) => {
  try {
    const { sessionId, currentUser, targetRecipientId, targetRecipientName, targetRecipientRole, transferNote } = req.body;
    if (!sessionId || !currentUser || !targetRecipientId) {
      return res.status(400).json({ error: 'Missing sessionId, currentUser, or targetRecipientId' });
    }

    const result = routingEngine.transferChat(
      sessionId,
      currentUser,
      targetRecipientId,
      targetRecipientName,
      targetRecipientRole,
      transferNote
    );

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to transfer consultation' });
  }
});

/**
 * POST /api/routing/unassign
 * Move consultation back to unassigned box (Any user role can perform this at any time)
 */
routingRouter.post('/unassign', (req: Request, res: Response) => {
  try {
    const { sessionId, operatorName } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const result = routingEngine.unassignChat(sessionId, operatorName || 'Staff Member');
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to unassign consultation' });
  }
});

/**
 * POST /api/routing/customisation/update
 * Update customer customisation measurements & specs from the chat
 */
routingRouter.post('/customisation/update', (req: Request, res: Response) => {
  try {
    const { sessionId, customisationData } = req.body;
    if (!sessionId || !customisationData) {
      return res.status(400).json({ error: 'Missing sessionId or customisationData' });
    }

    const result = routingEngine.updateCustomisation(sessionId, customisationData);
    return res.json(result);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update customisation data' });
  }
});

/**
 * GET /api/routing/queue
 * Get live escalation queue
 */
routingRouter.get('/queue', (req: Request, res: Response) => {
  const queue = routingEngine.getQueue();
  res.json({ success: true, queue });
});

/**
 * GET /api/routing/metrics
 * System-wide designer capacity & queue analytics
 */
routingRouter.get('/metrics', (req: Request, res: Response) => {
  const metrics = routingEngine.getSystemMetrics();
  res.json({ success: true, metrics });
});

