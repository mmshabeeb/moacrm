import { Router, Request, Response } from 'express';
import { ProductionSheetService } from '../services/productionSheetService';
import { MOAProductionOrder, ProductionStatus } from '../models/production';

export const productionRouter = Router();
const sheetService = new ProductionSheetService();

// In-memory database for production orders
export const productionOrdersDb = new Map<string, MOAProductionOrder>();

/**
 * GET /api/production/orders
 * List all production work orders
 */
productionRouter.get('/orders', (req: Request, res: Response) => {
  const orders = Array.from(productionOrdersDb.values());
  res.json({ success: true, count: orders.length, orders });
});

/**
 * GET /api/production/orders/:id/sheet
 * View or print tailor production sheet HTML
 */
productionRouter.get('/orders/:id/sheet', (req: Request, res: Response) => {
  const order = productionOrdersDb.get(req.params.id);
  if (!order) {
    return res.status(404).send('<h2>Production Order Not Found</h2>');
  }

  const html = sheetService.generatePrintableSheetHtml(order);
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

/**
 * PATCH /api/production/orders/:id/status
 * Updates manufacturing status
 */
productionRouter.patch('/orders/:id/status', (req: Request, res: Response) => {
  const { status, inspectorName } = req.body;
  const order = productionOrdersDb.get(req.params.id);
  
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  order.status = status as ProductionStatus;
  if (status === 'QUALITY_CHECK' && inspectorName) {
    order.quality_check_passed = true;
    order.quality_inspector_name = inspectorName;
  }

  return res.json({ success: true, message: `Status updated to ${status}`, order });
});
