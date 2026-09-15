import { Request, Response } from 'express';
import { productionOrdersDb } from '../routes/productionRoutes';
import { MOAProductionOrder } from '../models/production';

/**
 * Shopify orders/create Webhook Handler
 * Intercepts placed orders, extracts _moa_customisation_id from line items,
 * and links them with the MOA Production & Customisation Database.
 */
export async function handleShopifyOrderCreateWebhook(req: Request, res: Response) {
  try {
    const order = req.body;
    if (!order || !order.line_items) {
      return res.status(400).send('Invalid webhook payload');
    }

    console.log(`[Shopify Webhook] Processing Order #${order.order_number || order.name} (${order.id})`);

    for (const item of order.line_items) {
      // Find MOA customisation property
      const customProperty = (item.properties || []).find(
        (p: { name: string; value: string }) => p.name === '_moa_customisation_id'
      );

      if (customProperty && customProperty.value) {
        const customisationId = customProperty.value;
        console.log(`[Shopify Webhook] Linked Customisation ID: ${customisationId} to Order #${order.order_number}`);

        let existingProdOrder = productionOrdersDb.get(customisationId);
        if (existingProdOrder) {
          existingProdOrder.shopify_order_id = String(order.id);
          existingProdOrder.shopify_order_number = String(order.order_number || order.name);
          existingProdOrder.status = 'PRODUCTION_PENDING';
        } else {
          // Construct production order from line item properties
          const newProdOrder: MOAProductionOrder = {
            customisation_id: customisationId,
            shopify_order_id: String(order.id),
            shopify_order_number: String(order.order_number || order.name),
            customer_name: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim() || 'Customer',
            customer_email: order.customer?.email,
            order_date: order.created_at || new Date().toISOString(),
            product_id: String(item.product_id),
            product_name: item.title,
            product_category: 'abaya_standard',
            base_size: 56,
            measurements: {
              height_cm: 165,
              height_ft_display: "5'5\"",
              bust_inches: 38,
              garment_length_inches: 56
            },
            fit_preference: 'loose',
            alterations: {
              length_adjustment_inches: 0,
              sleeve_adjustment_inches: 0,
              other_alterations: []
            },
            status: 'PRODUCTION_PENDING',
            current_version: 1,
            revisions: [],
            customer_confirmed: true,
            customer_confirmed_at: new Date().toISOString(),
            designer_approved: true
          };
          productionOrdersDb.set(customisationId, newProdOrder);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).send('Webhook processing failed');
  }
}
