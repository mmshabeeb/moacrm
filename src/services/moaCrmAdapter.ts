import { EscalationDossier, StructuredCustomisationRecord } from '../models/customisation';
import { MOAProductionOrder } from '../models/production';

export interface MOACrmConfig {
  baseUrl: string;
  apiKey?: string;
  webhookSecret?: string;
}

export interface CrmHandoffResponse {
  success: boolean;
  crm_ticket_id: string;
  assigned_designer_name?: string;
  queue_status: 'QUEUED' | 'ASSIGNED' | 'LIVE_CHAT_ACTIVE';
  message: string;
}

/**
 * Adapter interface for MOA CRM API integration
 */
export class MOACrmAdapter {
  private config: MOACrmConfig;

  constructor(config: MOACrmConfig) {
    this.config = config;
  }

  /**
   * 1. Escalate a session to Senior Designer in MOA CRM
   */
  public async escalateToDesigner(dossier: EscalationDossier): Promise<CrmHandoffResponse> {
    const payload = {
      event: 'CUSTOMER_CUSTOMISATION_ESCALATION',
      session_id: dossier.session_id,
      timestamp: new Date().toISOString(),
      customer: {
        name: dossier.customer_name || 'Storefront Guest',
        contact: dossier.customer_contact || null,
      },
      product_context: {
        title: dossier.product_title,
        recommended_size: dossier.current_recommended_size,
      },
      extracted_measurements: dossier.measurements_summary,
      requested_alterations: dossier.requested_alterations,
      escalation_reason: dossier.reason_for_escalation,
      trigger_type: dossier.escalation_trigger,
      full_transcript: dossier.chat_history
    };

    // In production, performs fetch(`${this.config.baseUrl}/api/v1/conversations/escalate`, ...)
    console.log('[MOA CRM Adapter] Dispatching Escalation Payload:', JSON.stringify(payload, null, 2));

    return {
      success: true,
      crm_ticket_id: `CRM-${Date.now().toString().slice(-6)}`,
      assigned_designer_name: 'Senior Designer on Duty',
      queue_status: 'QUEUED',
      message: 'Consultation successfully transferred to Senior Designer.'
    };
  }

  /**
   * 2. Synchronize confirmed customisation with MOA CRM & Production Queue
   */
  public async syncConfirmedCustomisation(customisation: StructuredCustomisationRecord): Promise<{ synced: boolean; crm_record_id: string }> {
    const payload = {
      event: 'CUSTOMISATION_CONFIRMED',
      customisation_id: customisation.id,
      confirmed_at: customisation.confirmed_at || new Date().toISOString(),
      record: customisation
    };

    console.log('[MOA CRM Adapter] Syncing Confirmed Customisation:', JSON.stringify(payload, null, 2));

    return {
      synced: true,
      crm_record_id: `CRM-REC-${customisation.id}`
    };
  }

  /**
   * 3. Sync newly placed Shopify Order to link with Customisation ID
   */
  public async linkShopifyOrder(shopifyOrderId: string, customisationId: string, orderNumber: string): Promise<boolean> {
    console.log(`[MOA CRM Adapter] Linking Order #${orderNumber} (${shopifyOrderId}) <-> ${customisationId}`);
    return true;
  }
}
