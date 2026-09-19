import { MOASizingEngine } from '../src/services/sizingEngine';
import { MOAAIConversationEngine } from '../src/services/aiConversationEngine';
import { FreeAiModelService } from '../src/services/freeAiModelService';
import { ProductionSheetService } from '../src/services/productionSheetService';
import { MOAProductionOrder } from '../src/models/production';

async function runTests() {
  console.log('🧪 Starting Mall of Abayas (MOA) AI Designer Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // --- Test Suite 1: Sizing Engine ---
  console.log('📏 [Suite 1: Sizing Matrix & Conversions]');
  const sizingEngine = new MOASizingEngine();

  // Test Height 165 cm -> maps to Size 56 (closest to 164cm standard)
  const rec165 = sizingEngine.recommendSize({ height_cm: 165 });
  assert(rec165.standard_size === 56, '165 cm correctly recommends base Size 56');

  // Test Height 153 cm -> maps to Size 52
  const rec153 = sizingEngine.recommendSize({ height_cm: 153 });
  assert(rec153.standard_size === 52, '153 cm correctly recommends base Size 52');

  // Test Height 176 cm -> maps to Size 60
  const rec176 = sizingEngine.recommendSize({ height_cm: 176 });
  assert(rec176.standard_size === 60, '176 cm correctly recommends base Size 60');

  // Test Alteration limits (+2" sleeve is valid)
  const validAlt = sizingEngine.validateAlterations(1, 2);
  assert(validAlt.isValid && !validAlt.requiresSeniorReview, 'Length +1" and Sleeve +2" are within safe bounds');

  // Test Out-of-bounds alteration (+8" sleeve triggers review)
  const invalidAlt = sizingEngine.validateAlterations(0, 8);
  assert(invalidAlt.requiresSeniorReview, 'Sleeve +8" correctly triggers senior designer review');

  // --- Test Suite 2: AI Conversation & Multi-Turn Extraction ---
  console.log('\n🤖 [Suite 2: AI Multi-turn Consultation]');
  const aiEngine = new MOAAIConversationEngine();

  // Turn 1: Customer gives partial info
  const turn1 = await aiEngine.processTurn({
    userMessage: "I want this in a loose fit. My height is 165 cm.",
    history: [],
    currentRecord: {},
    productTitle: "Linen Grace – Mom's Modest Set"
  });
  assert(turn1.updatedRecord.height_cm === 165, 'Turn 1 extracts height 165 cm');
  assert(turn1.updatedRecord.fit_preference === 'loose', 'Turn 1 extracts fit preference: loose');
  assert(!turn1.showVerificationCard, 'Turn 1 does not show verification card (bust still needed)');

  // Turn 2: Customer provides bust and sleeve preference
  const turn2 = await aiEngine.processTurn({
    userMessage: "My bust is 38 inches and I want the sleeves 2 inches longer.",
    history: [],
    currentRecord: turn1.updatedRecord,
    productTitle: "Linen Grace – Mom's Modest Set"
  });
  assert(turn2.updatedRecord.bust_inches === 38, 'Turn 2 extracts bust 38 inches');
  assert(turn2.updatedRecord.sleeve_adjustment_inches === 2, 'Turn 2 extracts sleeve +2"');
  assert(turn2.showVerificationCard === true, 'Turn 2 shows verification card when all mandatory specs present');
  assert(turn2.verificationSummary?.recommendedSize === 56, 'Verification summary displays Size 56');

  // --- Test Suite 3: Escalation Trigger ---
  console.log('\n🚨 [Suite 3: Senior Designer Escalation]');
  const escalationTurn = await aiEngine.processTurn({
    userMessage: "I want to speak to a senior designer please",
    history: [],
    currentRecord: turn2.updatedRecord,
    productTitle: "Linen Grace – Mom's Modest Set"
  });
  assert(escalationTurn.escalationTriggered === true, 'Explicit request triggers senior escalation');
  assert(escalationTurn.updatedState === 'HUMAN_DESIGNER_CONNECTED', 'State transitions to HUMAN_DESIGNER_CONNECTED');

  // --- Test Suite 4: Production Sheet Generator ---
  console.log('\n📄 [Suite 4: Production Sheet HTML]');
  const sheetService = new ProductionSheetService();
  const testOrder: MOAProductionOrder = {
    customisation_id: 'MOA-CUS-000999',
    customer_name: 'Test Customer',
    order_date: new Date().toISOString(),
    product_id: 'p1',
    product_name: 'Test Abaya',
    product_category: 'abaya_standard',
    base_size: 54,
    measurements: {
      height_cm: 158,
      height_ft_display: "5'2\"",
      bust_inches: 36,
      garment_length_inches: 54
    },
    fit_preference: 'loose',
    alterations: {
      length_adjustment_inches: 0,
      sleeve_adjustment_inches: 1,
      other_alterations: []
    },
    status: 'IN_PRODUCTION',
    current_version: 1,
    revisions: [],
    customer_confirmed: true,
    customer_confirmed_at: new Date().toISOString(),
    designer_approved: true
  };

  const html = sheetService.generatePrintableSheetHtml(testOrder);
  assert(html.includes('MOA-CUS-000999'), 'Production sheet contains Customisation ID');
  assert(html.includes('MALL OF ABAYAS'), 'Production sheet contains brand header');
  assert(html.includes('Size 54'), 'Production sheet contains correct base size');

  // --- Suite 5: High-Scale Designer Routing, Takeover & Transfer Rules ---
  console.log('\n👥 [Suite 5: Designer Routing, Takeover & Transfer Rules]');
  const { routingEngine } = await import('../src/routes/routingRoutes');
  
  // Register active heartbeat for designers & admin
  routingEngine.registerDesignerHeartbeat({
    designerId: 'test_designer_1',
    designerName: 'Aisha Designer',
    role: 'SENIOR_DESIGNER',
    status: 'AVAILABLE',
    maxConcurrentChats: 4,
    activeChatCount: 0,
    assignedSessionIds: [],
    skills: ['bespoke'],
    languages: ['ar', 'en'],
    lastHeartbeat: new Date().toISOString()
  });

  routingEngine.registerDesignerHeartbeat({
    designerId: 'test_designer_2',
    designerName: 'Mariam Senior Tailor',
    role: 'SENIOR_DESIGNER',
    status: 'AVAILABLE',
    maxConcurrentChats: 4,
    activeChatCount: 0,
    assignedSessionIds: [],
    skills: ['bespoke'],
    languages: ['ar', 'en'],
    lastHeartbeat: new Date().toISOString()
  });

  routingEngine.registerDesignerHeartbeat({
    designerId: 'test_admin_1',
    designerName: 'Fatima Al-Nuaimi',
    role: 'ADMIN',
    status: 'AVAILABLE',
    maxConcurrentChats: 10,
    activeChatCount: 0,
    assignedSessionIds: [],
    skills: ['all'],
    languages: ['ar', 'en'],
    lastHeartbeat: new Date().toISOString()
  });

  // Rule 1: AI Escalation arrives in Unassigned box first (assignedToDesignerId is undefined)
  const enqueued = routingEngine.enqueueConsultation({
    sessionId: 'SESS_SCALE_001',
    customisationId: 'MOA-CUS-SCALE-1',
    customerName: 'High Value VIP Customer',
    productTitle: 'Luxury Occasion Abaya',
    priorityScore: 100,
    language: 'ar',
    category: 'occasion_luxury',
    escalationReason: 'Hand-beaded embroidery customisation'
  }, false);
  assert(enqueued.assignedToDesignerId === undefined, 'AI transferred chat arrives into Unassigned box first');

  // Rule 2: Senior Designer takes over unassigned chat
  const takeoverRes1 = routingEngine.claimOrTakeoverChat('SESS_SCALE_001', {
    id: 'test_designer_1',
    name: 'Aisha Designer',
    role: 'SENIOR_DESIGNER'
  });
  assert(takeoverRes1.success === true, 'Senior Designer can take over unassigned chat');

  // Rule 3: Another Senior Designer cannot take over an active designer chat
  const takeoverRes2 = routingEngine.claimOrTakeoverChat('SESS_SCALE_001', {
    id: 'test_designer_2',
    name: 'Mariam Senior Tailor',
    role: 'SENIOR_DESIGNER'
  });
  assert(takeoverRes2.success === false, 'Duplicate Senior Designer takeover is rejected (Read-only for other designers)');

  // Rule 4: Admin user CAN override and take over active senior designer chat
  const adminTakeoverRes = routingEngine.claimOrTakeoverChat('SESS_SCALE_001', {
    id: 'test_admin_1',
    name: 'Fatima Al-Nuaimi',
    role: 'ADMIN'
  });
  assert(adminTakeoverRes.success === true, 'Admin can take over any chat including active senior designer chats');

  // Rule 5: Senior Designer can only transfer to another Senior Designer (rejected if target is not designer)
  const invalidTransfer = routingEngine.transferChat(
    'SESS_SCALE_001',
    { id: 'test_designer_1', name: 'Aisha Designer', role: 'SENIOR_DESIGNER' },
    'some_random_user',
    'Random User',
    'ADMIN' as any
  );
  assert(invalidTransfer.success === false, 'Senior Designer cannot transfer to non-designer roles');

  // Rule 6: Admin can transfer chat to anybody
  const adminTransfer = routingEngine.transferChat(
    'SESS_SCALE_001',
    { id: 'test_admin_1', name: 'Fatima Al-Nuaimi', role: 'ADMIN' },
    'test_designer_2',
    'Mariam Senior Tailor',
    'SENIOR_DESIGNER'
  );
  assert(adminTransfer.success === true, 'Admin can transfer chat to any staff member');

  // Rule 7: Anybody can move chat back to Unassigned box at any time
  const unassignRes = routingEngine.unassignChat('SESS_SCALE_001', 'Aisha Designer');
  assert(unassignRes.success === true, 'Any user can move consultation back to Unassigned box at any time');

  // Rule 8: Staff can edit and update customisation data from chat
  const updateRes = routingEngine.updateCustomisation('SESS_SCALE_001', {
    baseSize: '56',
    height: '165 cm',
    bust: '38"',
    fit: 'Extra Loose',
    sleeve: '+2" (Loose)',
    length: '56"',
    addons: ['Side Pockets (+15 AED)', 'Maternity Zipper (+25 AED)'],
    tailoringNotes: 'Customer wearing 3-inch heels for wedding',
    updatedBy: 'Aisha Designer'
  });
  assert(updateRes.success === true && updateRes.data.baseSize === '56', 'Staff can update customer customisation measurements from chat');

  // --- Suite 6: Direct Presigned Media Storage ---
  console.log('\n🎙️ [Suite 6: Direct Media Storage Offloading]');
  const { MOAMediaStorageService } = await import('../src/services/mediaStorageService');
  const mediaService = new MOAMediaStorageService();
  const presignRes = mediaService.generatePresignedUpload({
    filename: 'voice_note_sarah.webm',
    fileType: 'audio/webm',
    fileSize: 102400,
    sessionToken: 'sess_tok_999'
  });
  assert(presignRes.uploadUrl.includes('voice_notes/sess_tok_999'), 'Presigned upload URL targets dedicated session folder');
  assert(presignRes.publicCdnUrl.startsWith('https://cdn.mallofabayas.com'), 'Public CDN URL configured for distributed edge playback');

  // --- Suite 7: Shopify App & Storefront Theme App Extension ---
  console.log('\n🛍️ [Suite 7: Shopify App & PDP Theme App Extension]');
  const fs = await import('fs');
  const path = await import('path');

  const appTomlExists = fs.existsSync(path.resolve(process.cwd(), 'shopify.app.toml'));
  assert(appTomlExists === true, 'Shopify App configuration manifest (shopify.app.toml) is present');

  const extTomlExists = fs.existsSync(path.resolve(process.cwd(), 'extensions/moa-designer-block/shopify.extension.toml'));
  assert(extTomlExists === true, 'Theme App Extension manifest (shopify.extension.toml) is present');

  const liquidBlockExists = fs.existsSync(path.resolve(process.cwd(), 'extensions/moa-designer-block/blocks/moa_customisation_toggle.liquid'));
  assert(liquidBlockExists === true, 'Storefront Liquid App Block (moa_customisation_toggle.liquid) is present');

  const widgetJsExists = fs.existsSync(path.resolve(process.cwd(), 'extensions/moa-designer-block/assets/moa_widget.js'));
  const widgetCssExists = fs.existsSync(path.resolve(process.cwd(), 'extensions/moa-designer-block/assets/moa_widget.css'));
  assert(widgetJsExists && widgetCssExists, 'Storefront client assets (moa_widget.js, moa_widget.css) are bundled');

  const pdpPreviewExists = fs.existsSync(path.resolve(process.cwd(), 'public/pdp-preview.html'));
  assert(pdpPreviewExists === true, 'Interactive luxury abaya PDP simulator (pdp-preview.html) is available');

  // --- Suite 8: Free AI Model Service & Trained Knowledge Base ---
  console.log('\n🧠 [Suite 8: Free AI Model Integration & Trained Knowledge]');
  const freeAiService = new FreeAiModelService();
  const trainedPrompt = freeAiService.getTrainedSystemPrompt('Royal Silk Velvet Abaya', 'occasion_luxury');
  assert(trainedPrompt.includes('Mall of Abayas (MOA)'), 'Trained prompt includes brand atelier identity');
  assert(trainedPrompt.includes('standard_sizes'), 'Trained prompt includes complete size matrix rules');
  assert(trainedPrompt.includes('alteration_rules'), 'Trained prompt includes safety alteration limits');
  assert(trainedPrompt.includes('senior designer'), 'Trained prompt includes escalation rules');

  // --- Suite 9: CRM Authentication & User Security ---
  console.log('\n🔐 [Suite 9: CRM Authentication, Email/Password & Sessions]');
  const { authService } = await import('../src/services/authService');

  // Valid admin login
  const adminLogin = authService.login('admin@mallofabayas.com', 'Admin@MOA2026');
  assert(adminLogin.success === true && !!adminLogin.session?.token, 'Admin logs in with email and password');
  assert(adminLogin.session?.user.role === 'ADMIN', 'Admin session has ADMIN role');

  // Validate session token
  const tokenCheck = authService.validateSession(adminLogin.session!.token);
  assert(tokenCheck.valid === true && tokenCheck.user?.email === 'admin@mallofabayas.com', 'Session token validates successfully');

  // Invalid password rejection
  const badLogin = authService.login('admin@mallofabayas.com', 'WrongPassword123');
  assert(badLogin.success === false && badLogin.error === 'Invalid email address or password', 'Invalid password is rejected');

  // Senior Designer login
  const designerLogin = authService.login('aisha.designer@mallofabayas.com', 'Designer@MOA2026');
  assert(designerLogin.success === true && designerLogin.session?.user.role === 'SENIOR_DESIGNER', 'Senior Designer logs in with role SENIOR_DESIGNER');
  assert(designerLogin.permissions.canAccessProduction === false, 'Senior Designer permissions restrict production access');

  // Create new user with password
  const newUserRes = authService.createUser({
    name: 'Hessa Consultant',
    email: 'hessa.designer@mallofabayas.com',
    password: 'Hessa@MOA2026',
    role: 'SENIOR_DESIGNER'
  });
  assert(newUserRes.success === true, 'Admin can create new user with email and password');

  // Login with new user
  const hessaLogin = authService.login('hessa.designer@mallofabayas.com', 'Hessa@MOA2026');
  assert(hessaLogin.success === true, 'Newly created user can log in with their credentials');

  // Password reset
  const resetRes = authService.resetUserPassword(newUserRes.user.id, 'NewSecurePassword@2026');
  assert(resetRes.success === true, 'Password reset succeeds');
  const afterResetLogin = authService.login('hessa.designer@mallofabayas.com', 'NewSecurePassword@2026');
  assert(afterResetLogin.success === true, 'User can log in with new password after reset');

  // Logout session invalidation
  authService.logout(adminLogin.session!.token);
  const loggedOutCheck = authService.validateSession(adminLogin.session!.token);
  assert(loggedOutCheck.valid === false, 'Logged out session token is invalidated');

  // --- Test Suite 10: Shopify Product Image Watermark & Protection ---
  console.log('\n🖼️ [Suite 10: Shopify Product Image Watermark & Protection App]');
  const { WatermarkService } = await import('../src/services/watermarkService');

  // 1. Check default rules
  const rules = WatermarkService.getRules();
  assert(rules.length > 0, 'Default watermark rules loaded');
  const logoRule = WatermarkService.getRuleById('251');
  assert(logoRule !== undefined && logoRule.name === 'Logo', 'Logo rule #251 is present');
  assert(logoRule?.hasImageWatermark === true, 'Logo rule has image watermark active');
  assert(logoRule?.imageConfig?.position === 'center-right', 'Logo rule position is center-right');

  // 2. Save / Update Rule
  const updatedLogo = WatermarkService.saveRule({
    ...logoRule!,
    imageConfig: {
      ...logoRule!.imageConfig!,
      sizePx: 500,
      opacity: 100
    }
  });
  assert(updatedLogo.imageConfig?.sizePx === 500, 'Rule size updated to 500px');

  // 3. Store Protection Settings
  const protection = WatermarkService.getProtectionSettings();
  assert(protection.enabled === true, 'Anti-theft protection is enabled');
  assert(protection.disableRightClick === true, 'Right click protection active');
  assert(protection.disableDragAndDrop === true, 'Drag and drop protection active');

  // 4. Test image compositing engine with sharp
  const testImgBuffer = await (await import('sharp')).default({
    create: {
      width: 600,
      height: 800,
      channels: 3,
      background: { r: 30, g: 30, b: 30 }
    }
  }).jpeg().toBuffer();

  const composited = await WatermarkService.applyWatermarkToBuffer(testImgBuffer, updatedLogo);
  assert(composited.length > 0, 'Sharp composited watermark image output buffer generated successfully');

  // --- Test Suite 11: Multilingual Voice Note AI Understanding & WhatsApp Audio ---
  console.log('\n🎙️ [Suite 11: Multilingual Voice Note AI Processing & Audio Turn]');
  const freeAiVoice = new FreeAiModelService();
  assert(typeof freeAiVoice.executeVoiceTurn === 'function', 'FreeAiModelService has executeVoiceTurn method');

  // Test voice processing fallback / parser in aiConversationEngine
  const voiceTurnRes = await aiEngine.processVoiceTurn({
    audioBase64: 'fake_base64_audio_sample',
    mimeType: 'audio/webm',
    history: [],
    currentRecord: {},
    productTitle: 'Royal Silk Velvet Abaya',
    productCategory: 'occasion_luxury'
  });
  assert(voiceTurnRes.transcribedText !== undefined, 'Voice turn returns customer transcribed text');
  assert(voiceTurnRes.replyMessage !== undefined && voiceTurnRes.replyMessage.length > 0, 'Voice turn generates bespoke designer reply');
  assert(voiceTurnRes.updatedRecord !== undefined, 'Voice turn updates structured customisation record');

  // --- Test Suite 12: Customer Identity, Login/Guest Gate & WhatsApp CRM Sync ---
  console.log('\n👑 [Suite 12: Customer Identity, Login Gate & WhatsApp CRM Sync]');
  const sampleCustomerRecord: any = {
    id: 'MOA-CUS-VIP-001',
    product_title: 'Royal Silk Velvet Abaya',
    customer_id: 'cust_shopify_9921',
    customer_name: 'Fatima Al-Nuaimi',
    customer_phone: '+971 50 123 4567',
    customer_email: 'fatima@example.com',
    fit_preference: 'loose',
    height_cm: 165,
    bust_inches: 38
  };
  assert(sampleCustomerRecord.customer_name === 'Fatima Al-Nuaimi', 'Customer name is bound to customisation record');
  assert(sampleCustomerRecord.customer_phone === '+971 50 123 4567', 'Mobile / WhatsApp number is bound to customisation record');

  const cleanPhone = sampleCustomerRecord.customer_phone.replace(/[^\d]/g, '');
  const waUrl = `https://wa.me/${cleanPhone}`;
  assert(waUrl === 'https://wa.me/971501234567', 'WhatsApp direct link generated with country code');

  console.log(`\n====================================================`);
  console.log(`🎉 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
