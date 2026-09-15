import { MOAProductionOrder, CustomisationRevision } from '../models/production';

export class ProductionSheetService {
  /**
   * Generates a clean, professional, tailor-ready HTML/Printable production sheet
   */
  public generatePrintableSheetHtml(order: MOAProductionOrder): string {
    const revisionsHtml = order.revisions.length > 0 
      ? `
        <div class="section revisions-section">
          <h3>REVISION AUDIT TRAIL</h3>
          <table>
            <thead>
              <tr>
                <th>Ver</th>
                <th>Updated By</th>
                <th>Date & Time</th>
                <th>Changes Summary</th>
              </tr>
            </thead>
            <tbody>
              ${order.revisions.map(r => `
                <tr>
                  <td>v${r.version}</td>
                  <td>${r.updated_by}</td>
                  <td>${new Date(r.updated_at).toLocaleString()}</td>
                  <td>${r.changes_summary}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>MOA Production Sheet - ${order.customisation_id}</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1a1a1a;
      background: #ffffff;
    }
    .sheet-container {
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #231f1e;
      padding: 24px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #231f1e;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 1px;
    }
    .header .tag {
      background: #231f1e;
      color: #ffffff;
      padding: 4px 10px;
      font-weight: bold;
      font-size: 13px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }
    .section {
      margin-bottom: 18px;
    }
    .section h3 {
      background: #f4f0eb;
      margin: 0 0 8px 0;
      padding: 6px 10px;
      font-size: 14px;
      border-left: 4px solid #8b5a2b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th, td {
      border: 1px solid #e0d8cf;
      padding: 8px 10px;
      text-align: left;
      font-size: 13px;
    }
    th {
      background: #faf8f5;
      font-weight: 600;
    }
    .highlight-badge {
      display: inline-block;
      padding: 2px 6px;
      background: #eef9f1;
      color: #1e7e34;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      font-weight: bold;
    }
    .footer-approvals {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 24px;
      border-top: 1px solid #231f1e;
      padding-top: 12px;
    }
    .approval-box {
      border: 1px dashed #736b63;
      padding: 10px;
      font-size: 12px;
      min-height: 50px;
    }
    @media print {
      body { padding: 0; }
      .sheet-container { border: 1px solid #000; }
    }
  </style>
</head>
<body>

<div class="sheet-container">
  <!-- Header -->
  <div class="header">
    <div>
      <h1>MALL OF ABAYAS</h1>
      <small style="color: #736b63;">MASTER TAILOR PRODUCTION WORK ORDER</small>
    </div>
    <div style="text-align: right;">
      <span class="tag">${order.status}</span>
      <div style="font-size: 14px; font-weight: bold; margin-top: 6px;">ID: ${order.customisation_id}</div>
      <div style="font-size: 13px; color: #555;">Order: ${order.shopify_order_number || 'PENDING'}</div>
    </div>
  </div>

  <!-- Order & Customer Info -->
  <div class="grid-2">
    <div class="section">
      <h3>PRODUCT SPECIFICATION</h3>
      <table>
        <tr><th>Product</th><td><strong>${order.product_name}</strong></td></tr>
        <tr><th>Category</th><td>${order.product_category}</td></tr>
        <tr><th>Reference Base Size</th><td><strong style="font-size: 15px;">Size ${order.base_size}</strong></td></tr>
        <tr><th>Color / Variant</th><td>${order.color || order.variant_name || 'Original'}</td></tr>
      </table>
    </div>

    <div class="section">
      <h3>CUSTOMER & DATES</h3>
      <table>
        <tr><th>Customer</th><td>${order.customer_name}</td></tr>
        <tr><th>Order Date</th><td>${new Date(order.order_date).toLocaleDateString()}</td></tr>
        <tr><th>Customer Confirmed</th><td><span class="highlight-badge">✓ Confirmed (${new Date(order.customer_confirmed_at).toLocaleTimeString()})</span></td></tr>
        <tr><th>Designer Sign-off</th><td>${order.designer_approved ? `✓ ${order.designer_name || 'Senior Designer'}` : 'Auto-validated'}</td></tr>
      </table>
    </div>
  </div>

  <!-- Master Tailor Measurements -->
  <div class="section">
    <h3>CUSTOM MEASUREMENTS & SPECIFICATIONS</h3>
    <table>
      <thead>
        <tr>
          <th>Measurement Parameter</th>
          <th>Customer Value</th>
          <th>Base Standard (Size ${order.base_size})</th>
          <th>Tailor Action Required</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Customer Height</strong></td>
          <td>${order.measurements.height_cm} cm (${order.measurements.height_ft_display})</td>
          <td>-</td>
          <td>Set garment length proportion</td>
        </tr>
        <tr>
          <td><strong>Bust Circumference</strong></td>
          <td><strong>${order.measurements.bust_inches}"</strong></td>
          <td>${order.base_size} standard ease</td>
          <td>Fit profile: <strong>${order.fit_preference.toUpperCase()}</strong></td>
        </tr>
        <tr>
          <td><strong>Garment Length</strong></td>
          <td><strong>${order.measurements.garment_length_inches}"</strong></td>
          <td>${order.base_size}"</td>
          <td><strong>${order.alterations.length_adjustment_inches >= 0 ? '+' : ''}${order.alterations.length_adjustment_inches}" adjustment</strong></td>
        </tr>
        <tr>
          <td><strong>Sleeve Length & Style</strong></td>
          <td><strong>${order.alterations.sleeve_adjustment_inches >= 0 ? '+' : ''}${order.alterations.sleeve_adjustment_inches}"</strong></td>
          <td>Standard</td>
          <td>${order.alterations.sleeve_style || 'Standard drape'}</td>
        </tr>
        ${order.measurements.waist_inches ? `
        <tr>
          <td><strong>Waist</strong></td>
          <td>${order.measurements.waist_inches}"</td>
          <td>-</td>
          <td>Maintain modest drape</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- Alterations & Notes -->
  <div class="section">
    <h3>ALTERATIONS & SPECIAL TAILOR NOTES</h3>
    <table>
      <tr>
        <th style="width: 25%;">Specific Alterations</th>
        <td>
          <ul>
            ${order.alterations.other_alterations.map(a => `<li>${a}</li>`).join('')}
            ${order.alterations.has_pockets ? '<li>Add pockets as requested</li>' : ''}
          </ul>
        </td>
      </tr>
      <tr>
        <th>Customer Request</th>
        <td><em>"${order.customer_notes || 'No extra notes provided.'}"</em></td>
      </tr>
      <tr>
        <th>Production / Tailor Notes</th>
        <td style="color: #8b5a2b; font-weight: bold;">
          ${order.tailor_production_notes || 'Ensure extra room in sleeves as requested. Double stitch armhole.'}
        </td>
      </tr>
    </table>
  </div>

  ${revisionsHtml}

  <!-- Footer Sign-offs -->
  <div class="footer-approvals">
    <div class="approval-box">
      <strong>Master Cutter:</strong><br><br>
      Sign: ____________ Date: ______
    </div>
    <div class="approval-box">
      <strong>Tailor / Stitcher:</strong><br><br>
      Sign: ____________ Date: ______
    </div>
    <div class="approval-box">
      <strong>Quality Check (QC):</strong><br><br>
      Sign: ____________ Date: ______
    </div>
  </div>
</div>

</body>
</html>
    `.trim();
  }
}
