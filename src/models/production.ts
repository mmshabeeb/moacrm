export type ProductionStatus = 
  | 'ORDER_RECEIVED'
  | 'CUSTOMISATION_CONFIRMED'
  | 'PRODUCTION_PENDING'
  | 'IN_PRODUCTION'
  | 'QUALITY_CHECK'
  | 'READY_FOR_DISPATCH'
  | 'COMPLETED';

export interface CustomisationRevision {
  version: number;
  updated_by: 'customer' | 'senior_designer' | 'production_lead';
  updated_at: string;
  changes_summary: string;
  previous_snapshot: Record<string, any>;
  designer_notes?: string;
  customer_reconfirmed?: boolean;
}

export interface MOAProductionOrder {
  customisation_id: string;          // e.g. MOA-CUS-000124
  shopify_order_id?: string;         // e.g. gid://shopify/Order/5849382910
  shopify_order_number?: string;     // e.g. #10482
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  order_date: string;
  
  // Product details
  product_id: string;
  product_name: string;
  product_category: 'abaya_standard' | 'modest_set' | 'occasion_luxury' | 'kaftan_butterfly' | 'inner_slip';
  variant_id?: string;
  variant_name?: string;
  base_size: number;                 // e.g. 56
  color?: string;
  sku?: string;
  
  // Measurements
  measurements: {
    height_cm: number;
    height_ft_display: string;
    bust_inches: number;
    waist_inches?: number;
    hips_inches?: number;
    shoulder_inches?: number;
    sleeve_length_inches?: number;
    garment_length_inches: number;
  };
  
  // Customisation & Alterations
  fit_preference: 'fitted' | 'regular' | 'loose' | 'extra_loose';
  alterations: {
    length_adjustment_inches: number;
    sleeve_adjustment_inches: number;
    sleeve_style?: string;
    has_pockets?: boolean;
    cuff_style?: string;
    embroidery_details?: string;
    other_alterations: string[];
  };
  
  // Notes & Instructions
  customer_notes?: string;
  designer_notes?: string;
  tailor_production_notes?: string;
  
  // Verification & Status
  status: ProductionStatus;
  current_version: number;
  revisions: CustomisationRevision[];
  customer_confirmed: boolean;
  customer_confirmed_at: string;
  designer_approved: boolean;
  designer_approved_at?: string;
  designer_name?: string;
  quality_check_passed?: boolean;
  quality_inspector_name?: string;
}
