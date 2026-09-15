import { Router, Request, Response } from 'express';
import { ProductionSheetService } from '../services/productionSheetService';
import { MOAProductionOrder, ProductionStatus } from '../models/production';

export const productionRouter = Router();
const sheetService = new ProductionSheetService();

// Mock in-memory database for production orders
export const productionOrdersDb = new Map<string, MOAProductionOrder>();

// Seed a sample order for instant demo/verification
const sampleOrder: MOAProductionOrder = {
  customisation_id: 'MOA-CUS-000124',
  shopify_order_id: 'gid://shopify/Order/5849382910',
  shopify_order_number: '#10482',
  customer_name: 'Sarah Al-Mansoor',
  customer_email: 'sarah@example.com',
  order_date: new Date().toISOString(),
  product_id: 'prod_928174',
  product_name: "Linen Grace – Mom's Modest Set",
  product_category: 'modest_set',
  base_size: 56,
  color: 'Olive Mist',
  measurements: {
    height_cm: 165,
    height_ft_display: "5'5\"",
    bust_inches: 38,
    waist_inches: 34,
    garment_length_inches: 57
  },
  fit_preference: 'extra_loose',
  alterations: {
    length_adjustment_inches: 1,
    sleeve_adjustment_inches: 2,
    sleeve_style: 'Extra room around armholes & relaxed cuff',
    has_pockets: true,
    other_alterations: ['Added hidden side pocket on right seam']
  },
  customer_notes: 'I prefer a modest, relaxed fit and slightly longer sleeves.',
  tailor_production_notes: 'Add 1" extra ease around armholes as requested by customer.',
  status: 'IN_PRODUCTION',
  current_version: 1,
  revisions: [],
  customer_confirmed: true,
  customer_confirmed_at: new Date(Date.now() - 3600000).toISOString(),
  designer_approved: true,
  designer_approved_at: new Date().toISOString(),
  designer_name: 'Senior Designer Fatima'
};

productionOrdersDb.set(sampleOrder.customisation_id, sampleOrder);

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
