/**
 * Mall of Abayas (MOA) CRM Portal Frontend Logic
 * Full WhatsApp Experience with Role-Based Takeover, Unassigned Escalation,
 * Multi-Tier Transfers, Dedicated AI Live Chats Tab, Emojis, Attachments,
 * and Advanced Voice Recording.
 */

let currentAuth = {
  user: {
    id: 'user_admin_1',
    name: 'Fatima Al-Nuaimi',
    role: 'ADMIN',
    email: 'fatima.admin@mallofabayas.com'
  },
  permissions: {
    canAccessConsultations: true,
    canAccessProduction: true,
    canAccessSettings: true,
    canManageUsers: true,
    canAccessSizeMatrix: true,
    canTakeoverAnyChat: true,
    canTakeoverUnassigned: true,
    canTransferToAnyone: true,
    canTransferToDesigners: true,
    canMoveToUnassigned: true
  }
};

// Current Active Consultation Tab & Filter
let currentChatCategory = 'UNASSIGNED'; // 'UNASSIGNED' | 'MY_CHATS' | 'ALL_STAFF'
let activeSessionId = null;
let activeAISessionId = null;

// Voice Recording State Machine
let recordingState = 'IDLE'; // 'IDLE' | 'RECORDING' | 'PAUSED'
let recordTimer = null;
let recordSeconds = 0;

// Cached Staff Users
let allStaffUsers = [];

// =======================================================
// LIVE STOREFRONT SESSION SYNC & POLLING
// =======================================================
async function fetchLiveStorefrontSessions() {
  try {
    const res = await fetch('/api/chat/sessions');
    const data = await res.json();
    if (data.success && Array.isArray(data.sessions)) {
      data.sessions.forEach(sess => {
        consultationSessions[sess.id] = sess;
      });

      updateCategoryCounts();

      // If viewing AI Chats tab, re-render and refresh detail view
      if (document.getElementById('tab-ai-chats')?.classList.contains('active')) {
        renderAIContactsList();
        if (!activeAISessionId || !consultationSessions[activeAISessionId]) {
          const aiIds = Object.keys(consultationSessions).filter(k => consultationSessions[k].isAIHandling);
          if (aiIds.length > 0) loadAISessionDetail(aiIds[0]);
        } else if (consultationSessions[activeAISessionId]) {
          loadAISessionDetail(activeAISessionId);
        }
      }

      // If viewing Live Consultations tab, re-render
      if (document.getElementById('tab-consultations')?.classList.contains('active')) {
        renderContactsList();
        if (activeSessionId && consultationSessions[activeSessionId]) {
          loadSessionDetail(activeSessionId);
        }
      }
    }
  } catch (err) {
    console.warn('Live session sync error:', err);
  }
}

// Start auto-syncing storefront sessions periodically
setInterval(fetchLiveStorefrontSessions, 2500);

// =======================================================
// INITIALIZATION & AUTHENTICATION
// =======================================================
document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  const isAuthenticated = await loadCurrentAuth();
  if (isAuthenticated) {
    await loadUsersList();
    initConsultations();
    initAIChats();
    loadProductionOrders();
    loadAddons();
  }
});

// Fill Quick Demo Login Credentials
function fillQuickLogin(email, password) {
  const emailInput = document.getElementById('login-email');
  const pwdInput = document.getElementById('login-password');
  if (emailInput) emailInput.value = email;
  if (pwdInput) pwdInput.value = password;
  
  const form = document.getElementById('moa-login-form');
  if (form) {
    const submitBtn = document.getElementById('login-submit-btn');
    if (submitBtn) submitBtn.click();
  }
}

// Toggle Password Field Visibility
function togglePasswordVisibility(fieldId, btn) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  if (field.type === 'password') {
    field.type = 'text';
    btn.innerText = '🙈';
  } else {
    field.type = 'password';
    btn.innerText = '👁️';
  }
}

// Handle Login Form Submit (Email & Password)
async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const email = (document.getElementById('login-email')?.value || '').trim();
  const password = document.getElementById('login-password')?.value || '';
  const errorAlert = document.getElementById('auth-error-alert');
  const submitBtn = document.getElementById('login-submit-btn');

  if (!email || !password) {
    if (errorAlert) {
      errorAlert.style.display = 'block';
      errorAlert.innerText = 'Please enter both your email address and password.';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying credentials...</span>';
  }

  if (errorAlert) errorAlert.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to Atelier CRM</span> &rarr;';
    }

    if (data.success && data.token) {
      localStorage.setItem('moa_crm_token', data.token);
      currentAuth.user = data.user;
      currentAuth.permissions = data.permissions;
      applyUserPermissions(data.user, data.permissions);

      // Hide login overlay
      const authScreen = document.getElementById('moa-auth-screen');
      if (authScreen) authScreen.classList.add('moa-auth-hidden');

      // Initialize workspace
      await loadUsersList();
      initConsultations();
      initAIChats();
      loadProductionOrders();
      loadAddons();
    } else {
      if (errorAlert) {
        errorAlert.style.display = 'block';
        errorAlert.innerText = data.error || 'Invalid email or password.';
      }
    }
  } catch (err) {
    console.error('Login error', err);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to Atelier CRM</span> &rarr;';
    }
    if (errorAlert) {
      errorAlert.style.display = 'block';
      errorAlert.innerText = 'Connection error. Please check server status.';
    }
  }
}

// Check Current Session Auth from Backend
async function loadCurrentAuth() {
  const token = localStorage.getItem('moa_crm_token');

  if (!token) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.user) {
      currentAuth.user = data.user;
      currentAuth.permissions = data.permissions;
      applyUserPermissions(data.user, data.permissions);
      return true;
    } else {
      localStorage.removeItem('moa_crm_token');
      window.location.href = '/login.html';
      return false;
    }
  } catch (err) {
    console.error('Failed to validate session token', err);
    window.location.href = '/login.html';
    return false;
  }
}

// Handle User Logout
async function handleLogout() {
  const token = localStorage.getItem('moa_crm_token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (e) {
      console.warn('Logout notification failed', e);
    }
  }

  localStorage.removeItem('moa_crm_token');
  localStorage.removeItem('moa_user_data');
  window.location.href = '/login.html';
}

// User List and Management
async function loadUsersList() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success && data.users) {
      allStaffUsers = data.users;
      renderUsersTable(data.users);
    }
  } catch (err) {
    console.error('Failed to load users list', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  tbody.innerHTML = users.map(u => {
    let roleClass = 'role-designer';
    let roleText = 'Senior Designer';
    if (u.role === 'ADMIN') {
      roleClass = 'role-admin';
      roleText = 'Master Admin';
    } else if (u.role === 'SUB_ADMIN') {
      roleClass = 'role-subadmin';
      roleText = 'Sub-Admin';
    }

    return `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td><code>${u.email}</code></td>
        <td><span class="role-badge ${roleClass}">${roleText}</span></td>
        <td><span class="status-badge status-active">${u.status}</span></td>
        <td><small style="color:#64748b;">${u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Never'}</small></td>
        <td>
          <button class="moa-action-btn" onclick="handleDeleteUser('${u.id}')" title="Delete User" style="color:#ef4444;">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openNewUserModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.style.display = 'none';
}

async function handleSaveUser(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('user-name-input')?.value;
  const email = document.getElementById('user-email-input')?.value;
  const password = document.getElementById('user-password-input')?.value;
  const role = document.getElementById('user-role-input')?.value;

  if (!name || !email || !role || !password) {
    alert('Please fill in all required fields.');
    return;
  }

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    if (data.success) {
      closeUserModal();
      await loadUsersList();
      alert(`User ${name} created successfully!`);
    } else {
      alert(data.error || 'Failed to create user');
    }
  } catch (err) {
    console.error('Error saving user', err);
    alert('Failed to connect to server');
  }
}

async function handleDeleteUser(userId) {
  if (!confirm('Are you sure you want to remove this team member?')) return;
  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await loadUsersList();
    } else {
      alert(data.error || 'Failed to delete user');
    }
  } catch (err) {
    console.error('Error deleting user', err);
  }
}

// Apply UI Permissions Based on Role
function applyUserPermissions(user, permissions) {
  const nameEl = document.getElementById('user-display-name');
  if (nameEl) nameEl.innerText = user.name;

  const avatarEl = document.getElementById('user-avatar-icon');
  if (avatarEl) avatarEl.innerText = user.name.charAt(0).toUpperCase();

  const myAvatarBadge = document.getElementById('wa-my-avatar-badge');
  if (myAvatarBadge) myAvatarBadge.innerText = user.name.charAt(0).toUpperCase();
  
  const roleBadge = document.getElementById('user-display-role');
  if (roleBadge) {
    if (user.role === 'ADMIN') {
      roleBadge.innerText = 'ADMIN (FULL ACCESS)';
      roleBadge.className = 'moa-user-role-badge moa-role-admin';
    } else if (user.role === 'SUB_ADMIN') {
      roleBadge.innerText = 'SUB-ADMIN';
      roleBadge.className = 'moa-user-role-badge moa-role-subadmin';
    } else {
      roleBadge.innerText = 'SENIOR DESIGNER (CHAT ONLY)';
      roleBadge.className = 'moa-user-role-badge moa-role-designer';
    }
  }

  const select = document.getElementById('role-switcher-select');
  if (select) select.value = user.id;

  const noticePill = document.getElementById('sidebar-role-pill');
  const noticeDesc = document.getElementById('sidebar-role-desc');
  if (noticePill && noticeDesc) {
    if (user.role === 'ADMIN') {
      noticePill.innerText = 'Admin Access';
      noticePill.style.color = '#8b5a2b';
      noticeDesc.innerText = 'Full access to take over any chat, transfer to anyone, manage production & settings.';
    } else if (user.role === 'SUB_ADMIN') {
      noticePill.innerText = 'Sub-Admin Access';
      noticePill.style.color = '#c2410c';
      noticeDesc.innerText = 'Operations access to take over any active chat, transfer consultations, and production queue.';
    } else {
      noticePill.innerText = 'Senior Designer (Chat Only)';
      noticePill.style.color = '#3730a3';
      noticeDesc.innerText = 'Restricted role: Access granted to Live Consultations, AI live monitoring, and customer takeover.';
    }
  }

  const prodBtn = document.getElementById('nav-btn-production');
  const addonsBtn = document.getElementById('nav-btn-addons');
  const usersBtn = document.getElementById('nav-btn-users');
  const sizesBtn = document.getElementById('nav-btn-sizes');

  if (user.role === 'SENIOR_DESIGNER') {
    if (prodBtn) prodBtn.style.display = 'none';
    if (addonsBtn) addonsBtn.style.display = 'none';
    if (usersBtn) usersBtn.style.display = 'none';
    if (sizesBtn) sizesBtn.style.display = 'none';
  } else {
    if (prodBtn) prodBtn.style.display = 'flex';
    if (addonsBtn) addonsBtn.style.display = 'flex';
    if (usersBtn) usersBtn.style.display = user.role === 'ADMIN' ? 'flex' : 'none';
    if (sizesBtn) sizesBtn.style.display = 'flex';
  }
}

// Tab Switching
function initTabs() {
  const buttons = document.querySelectorAll('.moa-nav-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(targetTabId) {
  const buttons = document.querySelectorAll('.moa-nav-btn');
  const panes = document.querySelectorAll('.moa-tab-pane');

  buttons.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === targetTabId);
  });
  panes.forEach(p => {
    p.classList.toggle('active', p.id === targetTabId);
  });

  if (targetTabId === 'tab-ai-chats') {
    renderAIContactsList();
    loadAISessionDetail(activeAISessionId);
  }
}

// =======================================================
// CONSULTATION SESSIONS DATA & UNASSIGNED FLOW
// =======================================================

let consultationSessions = {};

function initConsultations() {
  updateCategoryCounts();
  renderContactsList();
  if (activeSessionId && consultationSessions[activeSessionId]) {
    loadSessionDetail(activeSessionId);
  } else {
    const unassigned = getFilteredSessionIds();
    if (unassigned.length > 0) {
      loadSessionDetail(unassigned[0]);
    } else {
      renderEmptySessionDetail();
    }
  }
}

function initAIChats() {
  renderAIContactsList();
  if (activeAISessionId && consultationSessions[activeAISessionId]) {
    loadAISessionDetail(activeAISessionId);
  } else {
    const aiIds = Object.keys(consultationSessions).filter(k => consultationSessions[k].isAIHandling);
    if (aiIds.length > 0) {
      loadAISessionDetail(aiIds[0]);
    } else {
      renderEmptyAISessionDetail();
    }
  }
}

async function resetAllDemoData() {
  if (!confirm('Are you sure you want to reset all demo sessions and start completely clean with live data only?')) return;
  try {
    const res = await fetch('/api/chat/reset-demo-data', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      consultationSessions = {};
      activeSessionId = null;
      activeAISessionId = null;
      updateCategoryCounts();
      renderContactsList();
      renderAIContactsList();
      renderEmptySessionDetail();
      renderEmptyAISessionDetail();
      alert('✅ All demo data cleared. CRM is now in live mode.');
    }
  } catch (err) {
    console.error('Failed to reset demo data:', err);
  }
}

function renderEmptySessionDetail() {
  const dossierId = document.getElementById('dossier-customisation-id');
  if (dossierId) dossierId.innerText = 'NO ACTIVE CHAT';

  const custName = document.getElementById('dossier-customer-name');
  if (custName) custName.innerText = 'Waiting for customer...';

  const orderBadge = document.getElementById('dossier-order-badge');
  if (orderBadge) orderBadge.innerText = '';

  const prodTitle = document.getElementById('dossier-product-title');
  if (prodTitle) prodTitle.innerText = 'No consultation selected';

  const headerName = document.getElementById('wa-header-name');
  if (headerName) headerName.innerText = 'No Consultation Selected';

  const headerStatus = document.getElementById('wa-status-text');
  if (headerStatus) headerStatus.innerText = 'Select a chat from the left panel';

  const phoneBadge = document.getElementById('wa-customer-phone-badge');
  if (phoneBadge) phoneBadge.style.display = 'none';

  const waDirectBtn = document.getElementById('btn-wa-direct-link');
  if (waDirectBtn) waDirectBtn.style.display = 'none';

  const callDirectBtn = document.getElementById('btn-call-direct-link');
  if (callDirectBtn) callDirectBtn.style.display = 'none';

  const container = document.getElementById('wa-messages-container');
  if (container) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#8696a0; text-align:center; padding:2rem;">
        <span style="font-size:3rem; margin-bottom:12px;">💬</span>
        <h4 style="margin:0 0 6px 0; color:#475569;">No Live Consultation Selected</h4>
        <p style="margin:0; font-size:0.85rem; max-width:320px;">When a shopper on the storefront requests human tailoring assistance or is escalated by AI, their session will appear here in real time.</p>
      </div>
    `;
  }

  const standardToolbar = document.getElementById('wa-standard-toolbar');
  if (standardToolbar) standardToolbar.style.display = 'none';

  const lockedBar = document.getElementById('wa-locked-takeover-bar');
  if (lockedBar) {
    lockedBar.style.display = 'flex';
    const lockText = document.getElementById('wa-lock-text');
    if (lockText) lockText.innerText = 'No consultation active. Chats from the storefront will appear automatically.';
    const lockActionBtn = document.getElementById('wa-lock-action-btn');
    if (lockActionBtn) lockActionBtn.style.display = 'none';
  }
}

function renderEmptyAISessionDetail() {
  const dossierId = document.getElementById('ai-dossier-id');
  if (dossierId) dossierId.innerText = 'NO ACTIVE AI SESSION';

  const custName = document.getElementById('ai-dossier-customer');
  if (custName) custName.innerText = 'Waiting for storefront shopper...';

  const orderBadge = document.getElementById('ai-dossier-order');
  if (orderBadge) orderBadge.innerText = '';

  const prodTitle = document.getElementById('ai-dossier-product');
  if (prodTitle) prodTitle.innerText = 'No AI consultation active';

  const headerName = document.getElementById('ai-header-name');
  if (headerName) headerName.innerText = 'No AI Chat Selected';

  const container = document.getElementById('ai-messages-container');
  if (container) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#8696a0; text-align:center; padding:2rem;">
        <span style="font-size:3rem; margin-bottom:12px;">🤖</span>
        <h4 style="margin:0 0 6px 0; color:#475569;">No Active AI Chats</h4>
        <p style="margin:0; font-size:0.85rem; max-width:320px;">Live storefront customers speaking with the Gemini AI bespoke assistant will stream here in real time.</p>
      </div>
    `;
  }
}


// Switch Filter Category inside Live Consultations (UNASSIGNED, MY_CHATS, ALL_STAFF)
function switchChatCategory(category) {
  currentChatCategory = category;

  document.querySelectorAll('.wa-tab-chip').forEach(chip => chip.classList.remove('active'));
  if (category === 'UNASSIGNED') document.getElementById('chip-tab-unassigned')?.classList.add('active');
  if (category === 'MY_CHATS') document.getElementById('chip-tab-my')?.classList.add('active');
  if (category === 'ALL_STAFF') document.getElementById('chip-tab-all')?.classList.add('active');

  renderContactsList();

  const matching = getFilteredSessionIds();
  if (matching.length > 0 && !matching.includes(activeSessionId)) {
    loadSessionDetail(matching[0]);
  }
}

function getFilteredSessionIds(queryText = '') {
  const currentUserId = currentAuth.user?.id;
  const query = (queryText || '').toLowerCase().trim();

  return Object.keys(consultationSessions).filter(id => {
    const s = consultationSessions[id];

    // Exclude sessions currently purely handled by AI from the human staff consultations list
    if (s.isAIHandling) return false;

    // Text search query filter
    if (query) {
      const match = s.name.toLowerCase().includes(query) || s.preview.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
      if (!match) return false;
    }

    // Category filter
    if (currentChatCategory === 'UNASSIGNED') {
      return !s.claimedById;
    }
    if (currentChatCategory === 'MY_CHATS') {
      return s.claimedById === currentUserId;
    }
    if (currentChatCategory === 'ALL_STAFF') {
      return true; // All staff view
    }
    return true;
  });
}

function updateCategoryCounts() {
  const currentUserId = currentAuth.user?.id;
  let aiCount = 0;
  let unassignedCount = 0;
  let myCount = 0;
  let allCount = 0;

  Object.values(consultationSessions).forEach(s => {
    if (s.isAIHandling) {
      aiCount++;
    } else {
      allCount++;
      if (!s.claimedById) {
        unassignedCount++;
      } else if (s.claimedById === currentUserId) {
        myCount++;
      }
    }
  });

  const badgeAi = document.getElementById('badge-ai-chats');
  if (badgeAi) badgeAi.innerText = aiCount;

  const aiPanelCount = document.getElementById('ai-panel-count');
  if (aiPanelCount) aiPanelCount.innerText = aiCount;

  const unassignedEl = document.getElementById('count-unassigned');
  if (unassignedEl) unassignedEl.innerText = unassignedCount;

  const myEl = document.getElementById('count-my');
  if (myEl) myEl.innerText = myCount;

  const allEl = document.getElementById('count-all');
  if (allEl) allEl.innerText = allCount;

  const badgeEsc = document.getElementById('badge-escalations');
  if (badgeEsc) badgeEsc.innerText = unassignedCount;
}

function renderContactsList(filterText = '') {
  const container = document.getElementById('wa-contacts-list-container');
  if (!container) return;

  const filtered = getFilteredSessionIds(filterText);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem 1rem; text-align: center; color: #8696a0; font-size: 0.85rem;">
        <span style="font-size: 1.8rem; display: block; margin-bottom: 8px;">📭</span>
        No consultations found in <strong>${currentChatCategory}</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(id => {
    const s = consultationSessions[id];
    const isActive = id === activeSessionId;
    
    let badgeHtml = '';
    if (!s.claimedById) {
      badgeHtml = `<span style="font-size:0.65rem; background:#fef08a; color:#854d0e; padding:1px 6px; border-radius:4px; font-weight:700; white-space:nowrap; flex-shrink:0; display:inline-block;">⏳ Unassigned</span>`;
    } else if (s.claimedById === currentAuth.user?.id) {
      badgeHtml = `<span style="font-size:0.65rem; background:#e7fce3; color:#008069; padding:1px 6px; border-radius:4px; font-weight:700; white-space:nowrap; flex-shrink:0; display:inline-block;">✓ You</span>`;
    } else {
      badgeHtml = `<span style="font-size:0.65rem; background:#e0e7ff; color:#3730a3; padding:1px 6px; border-radius:4px; white-space:nowrap; flex-shrink:0; display:inline-block;">👤 ${s.claimedBy}</span>`;
    }

    return `
      <div class="wa-chat-item ${isActive ? 'active' : ''}" onclick="loadSessionDetail('${s.id}')">
        <div class="wa-avatar-img" style="background:${s.avatarColor};">${s.avatar}</div>
        <div class="wa-chat-info">
          <div class="wa-chat-top">
            <span class="wa-chat-name">${s.name}</span>
            <span class="wa-chat-time">${s.time}</span>
          </div>
          <div class="wa-chat-bottom">
            <span class="wa-chat-preview">${s.preview}</span>
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
              ${badgeHtml}
              ${s.unread > 0 ? `<span class="wa-unread-badge">${s.unread}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterConsultations(query) {
  renderContactsList(query);
}

// =======================================================
// AI LIVE CHATS TAB LOGIC & STOREFRONT MONITORING
// =======================================================

function renderAIContactsList(filterText = '') {
  const container = document.getElementById('ai-contacts-list-container');
  if (!container) return;

  const query = (filterText || '').toLowerCase().trim();
  const aiSessionIds = Object.keys(consultationSessions).filter(id => {
    const s = consultationSessions[id];
    if (!s.isAIHandling) return false;
    if (query) {
      return s.name.toLowerCase().includes(query) || s.preview.toLowerCase().includes(query) || s.id.toLowerCase().includes(query);
    }
    return true;
  });

  if (aiSessionIds.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem 1rem; text-align: center; color: #8696a0; font-size: 0.85rem;">
        <span style="font-size: 1.8rem; display: block; margin-bottom: 8px;">🤖</span>
        No active AI sessions right now
      </div>
    `;
    return;
  }

  container.innerHTML = aiSessionIds.map(id => {
    const s = consultationSessions[id];
    const isActive = id === activeAISessionId;

    return `
      <div class="wa-chat-item ${isActive ? 'active' : ''}" onclick="loadAISessionDetail('${s.id}')">
        <div class="wa-avatar-img" style="background:${s.avatarColor};">${s.avatar}</div>
        <div class="wa-chat-info">
          <div class="wa-chat-top">
            <span class="wa-chat-name">${s.name}</span>
            <span class="wa-chat-time">${s.time}</span>
          </div>
          <div class="wa-chat-bottom">
            <span class="wa-chat-preview">${s.preview}</span>
            <span style="font-size:0.65rem; background:#dcfce7; color:#15803d; padding:1px 5px; border-radius:4px; font-weight:700;">🤖 AI</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterAIConsultations(query) {
  renderAIContactsList(query);
}

function loadAISessionDetail(sessionId) {
  const session = consultationSessions[sessionId];
  if (!session) return;

  activeAISessionId = sessionId;
  renderAIContactsList();

  // Update AI Top Dossier Bar
  const dossierId = document.getElementById('ai-dossier-id');
  if (dossierId) dossierId.innerText = session.id;

  const custName = document.getElementById('ai-dossier-customer');
  if (custName) custName.innerText = session.name;

  const orderBadge = document.getElementById('ai-dossier-order');
  if (orderBadge) orderBadge.innerText = `(${session.orderNumber})`;

  const prodTitle = document.getElementById('ai-dossier-product');
  if (prodTitle) prodTitle.innerText = session.product;

  const baseSize = document.getElementById('ai-dossier-size');
  if (baseSize) baseSize.innerText = session.baseSize;

  const metricHeight = document.getElementById('ai-metric-height');
  if (metricHeight) metricHeight.innerText = session.height;

  const metricBust = document.getElementById('ai-metric-bust');
  if (metricBust) metricBust.innerText = session.bust;

  const metricFit = document.getElementById('ai-metric-fit');
  if (metricFit) metricFit.innerText = session.fit;

  const metricSleeve = document.getElementById('ai-metric-sleeve');
  if (metricSleeve) metricSleeve.innerText = session.sleeve;

  // Update AI Chat Header
  const headerAvatar = document.getElementById('ai-header-avatar');
  if (headerAvatar) {
    headerAvatar.innerText = session.avatar;
    headerAvatar.style.background = session.avatarColor;
  }

  const headerName = document.getElementById('ai-header-name');
  if (headerName) headerName.innerText = session.name;

  const aiPhoneBadge = document.getElementById('ai-customer-phone-badge');
  const aiWaLink = document.getElementById('ai-wa-direct-link');
  if (session.customerPhone) {
    if (aiPhoneBadge) {
      aiPhoneBadge.innerText = `📱 ${session.customerPhone}`;
      aiPhoneBadge.style.display = 'inline-block';
    }
    if (aiWaLink) {
      const clean = session.customerPhone.replace(/[^\d]/g, '');
      aiWaLink.href = `https://wa.me/${clean}`;
      aiWaLink.style.display = 'inline-flex';
    }
  } else {
    if (aiPhoneBadge) aiPhoneBadge.style.display = 'none';
    if (aiWaLink) aiWaLink.style.display = 'none';
  }

  // Render AI Messages Thread
  renderAIMessagesThread(session);
}

function renderAIMessagesThread(session) {
  const container = document.getElementById('ai-messages-container');
  if (!container) return;

  container.innerHTML = '';

  const dateDiv = document.createElement('div');
  dateDiv.className = 'wa-date-divider';
  dateDiv.innerHTML = `<span>TODAY</span>`;
  container.appendChild(dateDiv);

  session.messages.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `wa-bubble ${msg.incoming ? 'wa-bubble-incoming' : 'wa-bubble-outgoing'}`;
    bubble.innerHTML = `
      <div class="wa-bubble-content">
        <span class="${msg.incoming ? 'wa-author' : 'wa-author-designer'}">${msg.author}</span>
        <p>${msg.text}</p>
        <div class="wa-bubble-meta">
          <span class="wa-time">${msg.time}</span>
          ${!msg.incoming ? `<span class="wa-ticks">${msg.ticks || '✓✓'}</span>` : ''}
        </div>
      </div>
    `;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

// Take Over AI Chat (Intervene into AI consultation)
async function handleTakeoverAIChat() {
  const session = consultationSessions[activeAISessionId];
  if (!session) return;

  const user = currentAuth.user;

  // Transfer from AI to Current User
  session.isAIHandling = false;
  session.claimedBy = user.name;
  session.claimedById = user.id;
  session.claimedByRole = user.role;
  session.status = `🟢 live with ${user.name}`;

  session.messages.push({
    type: 'system',
    text: `⚡ ${user.name} intervened and took over the live consultation from AI Designer`
  });

  // Sync to Backend
  try {
    fetch('/api/chat/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        sessionToken: session.sessionToken || session.id,
        designerName: user.name,
        designerId: user.id,
        designerRole: user.role
      })
    }).catch(e => console.warn(e));

    fetch('/api/routing/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        user: { id: user.id, name: user.name, role: user.role }
      })
    }).catch(e => console.warn(e));
  } catch (err) {
    console.warn('Takeover sync error', err);
  }

  // Switch to Live Consultations Tab in "My Chats"
  activeSessionId = session.id;
  updateCategoryCounts();
  switchTab('tab-consultations');
  switchChatCategory('MY_CHATS');
  loadSessionDetail(session.id);
}

// =======================================================
// SESSION DETAIL, TAKEOVER RULES & LOCK BANNERS
// =======================================================

function loadSessionDetail(sessionId) {
  const session = consultationSessions[sessionId];
  if (!session) return;

  activeSessionId = sessionId;
  session.unread = 0;
  renderContactsList();

  // 1. Update Top Dossier Bar
  const dossierId = document.getElementById('dossier-customisation-id');
  if (dossierId) dossierId.innerText = session.id;

  const custName = document.getElementById('dossier-customer-name');
  if (custName) custName.innerText = session.name;

  const orderBadge = document.getElementById('dossier-order-badge');
  if (orderBadge) orderBadge.innerText = `(${session.orderNumber})`;

  const prodTitle = document.getElementById('dossier-product-title');
  if (prodTitle) prodTitle.innerText = session.product;

  const baseSize = document.getElementById('dossier-base-size');
  if (baseSize) baseSize.innerText = session.baseSize;

  const metricHeight = document.getElementById('dossier-metric-height');
  if (metricHeight) metricHeight.innerText = session.height;

  const metricBust = document.getElementById('dossier-metric-bust');
  if (metricBust) metricBust.innerText = session.bust;

  const metricFit = document.getElementById('dossier-metric-fit');
  if (metricFit) metricFit.innerText = session.fit;

  const metricSleeve = document.getElementById('dossier-metric-sleeve');
  if (metricSleeve) metricSleeve.innerText = session.sleeve;

  // 2. Update Header Contact Info
  const headerAvatar = document.getElementById('wa-header-avatar');
  if (headerAvatar) {
    headerAvatar.innerText = session.avatar;
    headerAvatar.style.background = session.avatarColor;
  }

  const headerName = document.getElementById('wa-header-name');
  if (headerName) headerName.innerText = session.name;

  const phoneBadge = document.getElementById('wa-customer-phone-badge');
  const waDirectBtn = document.getElementById('btn-wa-direct-link');
  const callDirectBtn = document.getElementById('btn-call-direct-link');

  if (session.customerPhone) {
    if (phoneBadge) {
      phoneBadge.innerText = `📱 ${session.customerPhone}`;
      phoneBadge.style.display = 'inline-block';
    }
    if (waDirectBtn) {
      const clean = session.customerPhone.replace(/[^\d]/g, '');
      waDirectBtn.href = `https://wa.me/${clean}`;
      waDirectBtn.style.display = 'inline-flex';
    }
    if (callDirectBtn) {
      callDirectBtn.href = `tel:${session.customerPhone}`;
      callDirectBtn.style.display = 'inline-flex';
    }
  } else {
    if (phoneBadge) phoneBadge.style.display = 'none';
    if (waDirectBtn) waDirectBtn.style.display = 'none';
    if (callDirectBtn) callDirectBtn.style.display = 'none';
  }

  const headerStatus = document.getElementById('wa-status-text');
  if (headerStatus) {
    if (!session.claimedById) {
      headerStatus.innerText = '⏳ Unassigned Queue (Waiting for Designer / Admin)';
      headerStatus.style.color = '#d97706';
    } else if (session.claimedById === currentAuth.user?.id) {
      headerStatus.innerText = `🟢 Live with You (${currentAuth.user.name})`;
      headerStatus.style.color = '#00a884';
    } else {
      headerStatus.innerText = `👤 Active with ${session.claimedBy} (${session.claimedByRole || 'Senior Designer'})`;
      headerStatus.style.color = '#4f46e5';
    }
  }

  // 3. Evaluate Permissions & Set Dossier Actions & Input Bar
  configureTakeoverAndInputControls(session);

  // 4. Render Message History
  renderMessagesThread(session);
}

/**
 * Core Takeover & Input Locking Logic
 */
function configureTakeoverAndInputControls(session) {
  const currentUserId = currentAuth.user?.id;
  const userRole = currentAuth.user?.role;
  const isAdminOrSubAdmin = userRole === 'ADMIN' || userRole === 'SUB_ADMIN';

  const claimBtn = document.getElementById('btn-claim-chat');
  const transferBtn = document.getElementById('btn-transfer-chat');
  const unassignBtn = document.getElementById('btn-unassign-chat');

  const lockedBar = document.getElementById('wa-locked-takeover-bar');
  const lockIcon = document.getElementById('wa-lock-icon');
  const lockText = document.getElementById('wa-lock-text');
  const lockActionBtn = document.getElementById('wa-lock-action-btn');

  const standardToolbar = document.getElementById('wa-standard-toolbar');
  const recordingToolbar = document.getElementById('wa-recording-toolbar');
  const textInput = document.getElementById('designer-reply-input');

  if (recordingToolbar) recordingToolbar.style.display = 'none';

  // SCENARIO 1: Session is assigned to CURRENT LOGGED IN USER (Active & Unlocked)
  if (session.claimedById && session.claimedById === currentUserId) {
    if (claimBtn) {
      claimBtn.innerText = '✓ Assigned to You';
      claimBtn.className = 'moa-btn moa-btn-primary';
      claimBtn.style.background = '#00a884';
      claimBtn.onclick = null;
    }
    if (transferBtn) transferBtn.style.display = 'inline-flex';
    if (unassignBtn) unassignBtn.style.display = 'inline-flex';

    if (lockedBar) lockedBar.style.display = 'none';
    if (standardToolbar) standardToolbar.style.display = 'flex';

    if (textInput) {
      textInput.placeholder = `Type a message as ${currentAuth.user.name}...`;
      textInput.focus();
    }
    return;
  }

  // SCENARIO 2: Session is UNASSIGNED (Waiting in queue)
  if (!session.claimedById) {
    if (claimBtn) {
      claimBtn.innerText = '⚡ Take Over Chat';
      claimBtn.className = 'moa-btn moa-btn-primary';
      claimBtn.style.background = '#00a884';
      claimBtn.onclick = handleClaimOrTakeover;
    }
    if (transferBtn) transferBtn.style.display = 'inline-flex';
    if (unassignBtn) unassignBtn.style.display = 'none';

    if (standardToolbar) standardToolbar.style.display = 'none';
    if (lockedBar) {
      lockedBar.style.display = 'flex';
      lockedBar.className = 'wa-locked-takeover-bar';
      if (lockIcon) lockIcon.innerText = '⏳';
      if (lockText) lockText.innerHTML = `<strong>Unassigned Consultation</strong> — Take over this consultation to start texting with the customer.`;
      if (lockActionBtn) {
        lockActionBtn.style.display = 'inline-flex';
        lockActionBtn.innerText = '⚡ Take Over Chat';
        lockActionBtn.className = 'moa-btn moa-btn-takeover';
        lockActionBtn.onclick = handleClaimOrTakeover;
      }
    }
    return;
  }

  // SCENARIO 3: Session is active with ANOTHER STAFF MEMBER (e.g. Aisha)
  if (session.claimedById && session.claimedById !== currentUserId) {
    if (isAdminOrSubAdmin) {
      // Admin / Sub-admin override power
      if (claimBtn) {
        claimBtn.innerText = `⚡ Take Over (from ${session.claimedBy})`;
        claimBtn.className = 'moa-btn moa-btn-primary moa-btn-override';
        claimBtn.style.background = '#8b5a2b';
        claimBtn.onclick = handleClaimOrTakeover;
      }
      if (transferBtn) transferBtn.style.display = 'inline-flex';
      if (unassignBtn) unassignBtn.style.display = 'inline-flex';

      if (standardToolbar) standardToolbar.style.display = 'none';
      if (lockedBar) {
        lockedBar.style.display = 'flex';
        lockedBar.className = 'wa-locked-takeover-bar wa-admin-override-bar';
        if (lockIcon) lockIcon.innerText = '👤';
        if (lockText) lockText.innerHTML = `Currently active with <strong>${session.claimedBy}</strong>. As Administrator, you can take over anytime.`;
        if (lockActionBtn) {
          lockActionBtn.style.display = 'inline-flex';
          lockActionBtn.innerText = '⚡ Take Over Consultation';
          lockActionBtn.className = 'moa-btn moa-btn-takeover moa-btn-override';
          lockActionBtn.onclick = handleClaimOrTakeover;
        }
      }
    } else {
      // Senior Designer viewing another designer's active chat -> Read Only
      if (claimBtn) {
        claimBtn.innerText = `👤 Active with ${session.claimedBy}`;
        claimBtn.className = 'moa-btn moa-btn-outline';
        claimBtn.style.background = '#f3f4f6';
        claimBtn.onclick = null;
      }
      if (transferBtn) transferBtn.style.display = 'none';
      if (unassignBtn) unassignBtn.style.display = 'none';

      if (standardToolbar) standardToolbar.style.display = 'none';
      if (lockedBar) {
        lockedBar.style.display = 'flex';
        lockedBar.className = 'wa-locked-takeover-bar wa-read-only-bar';
        if (lockIcon) lockIcon.innerText = '🔒';
        if (lockText) lockText.innerHTML = `Active consultation with <strong>${session.claimedBy}</strong> (Read Only).`;
        if (lockActionBtn) lockActionBtn.style.display = 'none';
      }
    }
  }
}

// =======================================================
// TAKEOVER, UNASSIGN & TRANSFER ACTIONS
// =======================================================

async function handleClaimOrTakeover() {
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  const previousOwner = session.claimedBy;
  const user = currentAuth.user;

  try {
    const res = await fetch('/api/routing/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to take over consultation');
      return;
    }

    session.claimedBy = user.name;
    session.claimedById = user.id;
    session.claimedByRole = user.role;
    session.isAIHandling = false;
    session.status = `🟢 live with ${user.name}`;

    fetch('/api/chat/takeover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        sessionToken: session.sessionToken || session.id,
        designerName: user.name,
        designerId: user.id,
        designerRole: user.role
      })
    }).catch(e => console.warn(e));

    if (previousOwner && previousOwner !== user.name) {
      session.messages.push({
        type: 'system',
        text: `⚡ ${user.name} (${user.role}) took over consultation from ${previousOwner}`
      });
    } else {
      session.messages.push({
        type: 'system',
        text: `🔵 ${user.name} took over the consultation from Unassigned queue`
      });
    }

    updateCategoryCounts();
    renderContactsList();
    loadSessionDetail(session.id);

  } catch (err) {
    console.error('Error claiming chat', err);
    session.claimedBy = user.name;
    session.claimedById = user.id;
    session.claimedByRole = user.role;
    session.isAIHandling = false;
    session.messages.push({
      type: 'system',
      text: `🔵 ${user.name} took over the consultation`
    });
    updateCategoryCounts();
    renderContactsList();
    loadSessionDetail(session.id);
  }
}

// Move chat back to UNASSIGNED box
async function handleUnassignChat() {
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  if (!confirm(`Return consultation for ${session.name} (${session.id}) to the Unassigned Queue?`)) {
    return;
  }

  const previousOwner = session.claimedBy || 'Staff';
  const user = currentAuth.user;

  try {
    await fetch('/api/routing/unassign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        operatorName: user.name
      })
    });
  } catch (err) {
    console.error('Unassign error', err);
  }

  session.claimedBy = null;
  session.claimedById = null;
  session.claimedByRole = null;
  session.status = 'online • waiting in unassigned queue';

  session.messages.push({
    type: 'system',
    text: `⏳ ${user.name} returned this consultation to the Unassigned Queue`
  });

  updateCategoryCounts();
  renderContactsList();
  loadSessionDetail(session.id);
}

// =======================================================
// TRANSFER MODAL
// =======================================================

async function loadUsersList() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    if (data.success && data.users) {
      allStaffUsers = data.users;
    }
  } catch (err) {
    console.error('Failed to load users list', err);
  }
}

function openTransferModal() {
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  document.getElementById('transfer-modal-cust-name').innerText = session.name;
  document.getElementById('transfer-modal-id').innerText = session.id;

  const select = document.getElementById('transfer-recipient-select');
  if (!select) return;

  const userRole = currentAuth.user?.role;
  const currentUserId = currentAuth.user?.id;
  const isAdminOrSubAdmin = userRole === 'ADMIN' || userRole === 'SUB_ADMIN';

  let optionsHtml = `
    <optgroup label="General Queue">
      <option value="UNASSIGNED" style="font-weight:bold; color:#854d0e;">⏳ Move back to Unassigned Queue (Anybody can take over)</option>
    </optgroup>
  `;

  const eligibleStaff = allStaffUsers.filter(u => {
    if (u.id === currentUserId) return false;
    if (isAdminOrSubAdmin) return true;
    return u.role === 'SENIOR_DESIGNER';
  });

  if (eligibleStaff.length > 0) {
    optionsHtml += `
      <optgroup label="${isAdminOrSubAdmin ? 'Senior Designers & Staff Members' : 'Other Senior Designers'}">
        ${eligibleStaff.map(u => `
          <option value="${u.id}" data-name="${u.name}" data-role="${u.role}">
            👤 ${u.name} (${u.role === 'ADMIN' ? 'Admin' : u.role === 'SUB_ADMIN' ? 'Sub-Admin' : 'Senior Designer'})
          </option>
        `).join('')}
      </optgroup>
    `;
  }

  select.innerHTML = optionsHtml;
  document.getElementById('transfer-chat-modal').style.display = 'flex';
}

function closeTransferModal() {
  document.getElementById('transfer-chat-modal').style.display = 'none';
}

async function submitTransferChat() {
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  const select = document.getElementById('transfer-recipient-select');
  const targetId = select.value;
  const noteInput = document.getElementById('transfer-note-input');
  const transferNote = noteInput ? noteInput.value.trim() : '';

  const user = currentAuth.user;

  if (targetId === 'UNASSIGNED') {
    closeTransferModal();
    handleUnassignChat();
    return;
  }

  const selectedOption = select.options[select.selectedIndex];
  const targetName = selectedOption.getAttribute('data-name');
  const targetRole = selectedOption.getAttribute('data-role');

  try {
    const res = await fetch('/api/routing/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        currentUser: user,
        targetRecipientId: targetId,
        targetRecipientName: targetName,
        targetRecipientRole: targetRole,
        transferNote
      })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.message || 'Failed to transfer chat');
      return;
    }

    session.claimedBy = targetName;
    session.claimedById = targetId;
    session.claimedByRole = targetRole;
    session.status = `online • transferred to ${targetName}`;

    session.messages.push({
      type: 'system',
      text: `🔄 Transferred by ${user.name} to ${targetName}${transferNote ? ` (Note: ${transferNote})` : ''}`
    });

    closeTransferModal();
    updateCategoryCounts();
    renderContactsList();
    loadSessionDetail(session.id);

  } catch (err) {
    console.error('Transfer error', err);
  }
}

// =======================================================
// CUSTOMER CUSTOMISATION EDITING MODAL & LOGIC
// =======================================================

function openEditCustomisationModal() {
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  // Set modal header & product info
  const subtitleEl = document.getElementById('edit-modal-subtitle');
  if (subtitleEl) subtitleEl.innerText = `${session.name} • ${session.id} (${session.orderNumber})`;

  const prodEl = document.getElementById('edit-modal-product-title');
  if (prodEl) prodEl.innerText = session.product;

  const badgeEl = document.getElementById('edit-modal-badge');
  if (badgeEl) badgeEl.innerText = session.id;

  // Fill form inputs
  const sizeSelect = document.getElementById('edit-cust-base-size');
  if (sizeSelect) sizeSelect.value = session.baseSize || '54';

  const fitSelect = document.getElementById('edit-cust-fit');
  if (fitSelect) fitSelect.value = session.fit || 'Regular Flared';

  const heightInput = document.getElementById('edit-cust-height');
  if (heightInput) heightInput.value = session.height || '';

  const bustInput = document.getElementById('edit-cust-bust');
  if (bustInput) bustInput.value = session.bust || '';

  const sleeveInput = document.getElementById('edit-cust-sleeve');
  if (sleeveInput) sleeveInput.value = session.sleeve || 'Standard';

  const lengthInput = document.getElementById('edit-cust-length');
  if (lengthInput) lengthInput.value = session.length || 'Standard';

  // Add-ons checkboxes
  const sessionAddons = session.addons || [];
  const sidePocketsCb = document.getElementById('addon-side-pockets');
  if (sidePocketsCb) sidePocketsCb.checked = sessionAddons.some(a => a.includes('Pockets'));

  const maternityZipCb = document.getElementById('addon-maternity-zip');
  if (maternityZipCb) maternityZipCb.checked = sessionAddons.some(a => a.includes('Maternity') || a.includes('Feeding') || a.includes('Zipper'));

  const hijabCb = document.getElementById('addon-matching-hijab');
  if (hijabCb) hijabCb.checked = sessionAddons.some(a => a.includes('Hijab'));

  const organzaCb = document.getElementById('addon-organza-cuff');
  if (organzaCb) organzaCb.checked = sessionAddons.some(a => a.includes('Organza') || a.includes('Cuffs'));

  // Tailoring notes
  const notesEl = document.getElementById('edit-cust-notes');
  if (notesEl) notesEl.value = session.tailoringNotes || '';

  document.getElementById('edit-customisation-modal').style.display = 'flex';
}

function closeEditCustomisationModal() {
  const modal = document.getElementById('edit-customisation-modal');
  if (modal) modal.style.display = 'none';
}

async function handleSaveCustomisation(e) {
  e.preventDefault();
  const session = consultationSessions[activeSessionId];
  if (!session) return;

  const baseSize = document.getElementById('edit-cust-base-size').value;
  const fit = document.getElementById('edit-cust-fit').value;
  const height = document.getElementById('edit-cust-height').value.trim();
  const bust = document.getElementById('edit-cust-bust').value.trim();
  const sleeve = document.getElementById('edit-cust-sleeve').value.trim() || 'Standard';
  const length = document.getElementById('edit-cust-length').value.trim() || 'Standard';
  const tailoringNotes = document.getElementById('edit-cust-notes').value.trim();

  // Collect checked add-ons
  const selectedAddons = [];
  if (document.getElementById('addon-side-pockets')?.checked) selectedAddons.push('Side Pockets (+15 AED)');
  if (document.getElementById('addon-maternity-zip')?.checked) selectedAddons.push('Maternity Zipper (+25 AED)');
  if (document.getElementById('addon-matching-hijab')?.checked) selectedAddons.push('Matching Hijab (+35 AED)');
  if (document.getElementById('addon-organza-cuff')?.checked) selectedAddons.push('Organza Lined Cuffs (+30 AED)');

  // Update session record
  session.baseSize = baseSize;
  session.fit = fit;
  session.height = height;
  session.bust = bust;
  session.sleeve = sleeve;
  session.length = length;
  session.addons = selectedAddons;
  session.tailoringNotes = tailoringNotes;

  const user = currentAuth.user;

  // Build summary message
  const specDetails = [
    `Size: <strong>${baseSize}</strong>`,
    `Height: <strong>${height}</strong>`,
    `Bust: <strong>${bust}</strong>`,
    `Fit: <strong>${fit}</strong>`,
    `Sleeve: <strong>${sleeve}</strong>`
  ];
  if (length && length !== 'Standard') specDetails.push(`Length: <strong>${length}</strong>`);
  if (selectedAddons.length > 0) specDetails.push(`Add-ons: <strong>${selectedAddons.join(', ')}</strong>`);
  if (tailoringNotes) specDetails.push(`Notes: <em>"${tailoringNotes}"</em>`);

  session.messages.push({
    type: 'system',
    text: `✏️ Customisation specs updated by ${user.name}: ${specDetails.join(' • ')}`
  });

  // Sync with Backend
  try {
    await fetch('/api/routing/customisation/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        customisationData: {
          baseSize,
          fit,
          height,
          bust,
          sleeve,
          length,
          addons: selectedAddons,
          tailoringNotes,
          updatedBy: user.name
        }
      })
    });
  } catch (err) {
    console.error('Failed to sync customisation update', err);
  }

  closeEditCustomisationModal();
  loadSessionDetail(session.id);
}

// =======================================================
// WHATSAPP CHAT THREAD RENDERING
// =======================================================

function renderMessagesThread(session) {
  const container = document.getElementById('wa-messages-container');
  if (!container) return;

  container.innerHTML = '';

  const dateDiv = document.createElement('div');
  dateDiv.className = 'wa-date-divider';
  dateDiv.innerHTML = `<span>${session.time === 'Yesterday' ? 'YESTERDAY' : 'TODAY'}</span>`;
  container.appendChild(dateDiv);

  session.messages.forEach(msg => {
    if (msg.type === 'system') {
      const pill = document.createElement('div');
      pill.className = 'wa-system-pill';
      pill.innerHTML = `<span>${msg.text}</span>`;
      container.appendChild(pill);
    } else if (msg.type === 'image') {
      const bubble = document.createElement('div');
      bubble.className = `wa-bubble ${msg.incoming ? 'wa-bubble-incoming' : 'wa-bubble-outgoing'} wa-bubble-media`;
      bubble.innerHTML = `
        <div class="wa-bubble-content">
          <span class="${msg.incoming ? 'wa-author' : 'wa-author-designer'}">${msg.author}</span>
          <div class="wa-image-attachment">
            <img src="${msg.imgSrc}" alt="Shared image" />
          </div>
          ${msg.text ? `<p style="margin-top:6px;">${msg.text}</p>` : ''}
          <div class="wa-bubble-meta">
            <span class="wa-time">${msg.time}</span>
            ${!msg.incoming ? `<span class="wa-ticks">✓✓</span>` : ''}
          </div>
        </div>
      `;
      container.appendChild(bubble);
    } else if (msg.type === 'audio') {
      const bubble = document.createElement('div');
      bubble.className = `wa-bubble ${msg.incoming ? 'wa-bubble-incoming' : 'wa-bubble-outgoing'} wa-bubble-audio`;
      bubble.innerHTML = `
        <div class="wa-bubble-content">
          <span class="${msg.incoming ? 'wa-author' : 'wa-author-designer'}">${msg.author}</span>
          <div class="wa-audio-player">
            <button class="wa-play-btn" onclick="toggleAudioPlay(this)">▶</button>
            <div class="wa-audio-waveform">
              <div class="wa-wave-bar" style="height:12px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:18px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:8px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:22px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:14px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:20px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
              <div class="wa-wave-bar" style="height:16px; background:${msg.incoming ? '#8696a0' : '#00a884'};"></div>
            </div>
            <span class="wa-audio-duration">${msg.duration}</span>
          </div>
          <div class="wa-bubble-meta">
            <span class="wa-time">${msg.time}</span>
            ${!msg.incoming ? `<span class="wa-ticks">✓✓</span>` : ''}
          </div>
        </div>
      `;
      container.appendChild(bubble);
    } else {
      const bubble = document.createElement('div');
      bubble.className = `wa-bubble ${msg.incoming ? 'wa-bubble-incoming' : 'wa-bubble-outgoing'}`;
      bubble.innerHTML = `
        <div class="wa-bubble-content">
          <span class="${msg.incoming ? 'wa-author' : 'wa-author-designer'}">${msg.author}</span>
          <p>${msg.text}</p>
          <div class="wa-bubble-meta">
            <span class="wa-time">${msg.time}</span>
            ${!msg.incoming ? `<span class="wa-ticks">${msg.ticks || '✓✓'}</span>` : ''}
          </div>
        </div>
      `;
      container.appendChild(bubble);
    }
  });

  container.scrollTop = container.scrollHeight;
}

// =======================================================
// WHATSAPP MESSAGING, EMOJIS & ATTACHMENTS
// =======================================================

function handleInputKeydown(e) {
  if (e.key === 'Enter') {
    sendDesignerReply();
  }
}

function sendDesignerReply() {
  const input = document.getElementById('designer-reply-input');
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  const time = getCurrentTimeString();
  const author = currentAuth.user?.name || 'Senior Designer';

  const session = consultationSessions[activeSessionId];
  if (session) {
    session.messages.push({
      type: 'text',
      incoming: false,
      author,
      text,
      time,
      ticks: '✓✓'
    });
    session.preview = text;
    session.time = time;
    renderContactsList();
    renderMessagesThread(session);

    // Sync directly to storefront customer session on backend
    fetch('/api/chat/designer-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        sessionToken: session.sessionToken || session.id,
        message: text,
        designerName: author,
        designerId: currentAuth.user?.id
      })
    }).catch(err => console.warn('Error sending designer reply to server:', err));
  }

  input.value = '';
  document.getElementById('wa-emoji-tray').style.display = 'none';
  document.getElementById('wa-attachment-tray').style.display = 'none';
}

function toggleEmojiTray() {
  const tray = document.getElementById('wa-emoji-tray');
  const attachTray = document.getElementById('wa-attachment-tray');
  if (attachTray) attachTray.style.display = 'none';
  tray.style.display = tray.style.display === 'none' ? 'grid' : 'none';
}

function insertEmoji(emoji) {
  const input = document.getElementById('designer-reply-input');
  input.value += emoji;
  input.focus();
  document.getElementById('wa-emoji-tray').style.display = 'none';
}

function toggleAttachmentTray() {
  const tray = document.getElementById('wa-attachment-tray');
  const emojiTray = document.getElementById('wa-emoji-tray');
  if (emojiTray) emojiTray.style.display = 'none';
  tray.style.display = tray.style.display === 'none' ? 'flex' : 'none';
}

function triggerFileUpload(type) {
  document.getElementById('wa-attachment-tray').style.display = 'none';
  const fileInput = document.getElementById('wa-file-input');
  fileInput.setAttribute('data-type', type);
  fileInput.click();
}

function handleFileAttached(e) {
  const file = e.target.files[0];
  if (!file) return;

  const time = getCurrentTimeString();
  const author = currentAuth.user?.name || 'Senior Designer';
  const session = consultationSessions[activeSessionId];

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      if (session) {
        session.messages.push({
          type: 'image',
          incoming: false,
          author,
          imgSrc: evt.target.result,
          text: file.name,
          time
        });
        session.preview = `📷 ${file.name}`;
        session.time = time;
        renderContactsList();
        renderMessagesThread(session);
      }
    };
    reader.readAsDataURL(file);
  } else {
    if (session) {
      session.messages.push({
        type: 'text',
        incoming: false,
        author,
        text: `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        time,
        ticks: '✓✓'
      });
      session.preview = `📄 ${file.name}`;
      session.time = time;
      renderContactsList();
      renderMessagesThread(session);
    }
  }

  e.target.value = '';
}

// =======================================================
// VOICE RECORDING CONTROLS
// =======================================================

function startVoiceRecording() {
  recordingState = 'RECORDING';
  recordSeconds = 0;

  document.getElementById('wa-standard-toolbar').style.display = 'none';
  document.getElementById('wa-recording-toolbar').style.display = 'flex';
  document.getElementById('wa-emoji-tray').style.display = 'none';
  document.getElementById('wa-attachment-tray').style.display = 'none';

  document.getElementById('wa-recording-dot').classList.remove('paused');
  document.getElementById('wa-live-waveform').classList.remove('paused');
  document.getElementById('icon-pause').style.display = 'block';
  document.getElementById('icon-resume').style.display = 'none';
  updateRecordingTimerDisplay();

  clearInterval(recordTimer);
  recordTimer = setInterval(() => {
    recordSeconds++;
    updateRecordingTimerDisplay();
  }, 1000);
}

function togglePauseResumeRecording() {
  if (recordingState === 'RECORDING') {
    recordingState = 'PAUSED';
    clearInterval(recordTimer);
    document.getElementById('wa-recording-dot').classList.add('paused');
    document.getElementById('wa-live-waveform').classList.add('paused');
    document.getElementById('icon-pause').style.display = 'none';
    document.getElementById('icon-resume').style.display = 'block';
  } else if (recordingState === 'PAUSED') {
    recordingState = 'RECORDING';
    document.getElementById('wa-recording-dot').classList.remove('paused');
    document.getElementById('wa-live-waveform').classList.remove('paused');
    document.getElementById('icon-pause').style.display = 'block';
    document.getElementById('icon-resume').style.display = 'none';

    recordTimer = setInterval(() => {
      recordSeconds++;
      updateRecordingTimerDisplay();
    }, 1000);
  }
}

function discardVoiceRecording() {
  clearInterval(recordTimer);
  recordingState = 'IDLE';
  recordSeconds = 0;
  document.getElementById('wa-recording-toolbar').style.display = 'none';
  document.getElementById('wa-standard-toolbar').style.display = 'flex';
}

function finishAndSendVoiceRecording() {
  clearInterval(recordTimer);
  const duration = formatDuration(recordSeconds > 0 ? recordSeconds : 3);
  recordingState = 'IDLE';
  recordSeconds = 0;

  document.getElementById('wa-recording-toolbar').style.display = 'none';
  document.getElementById('wa-standard-toolbar').style.display = 'flex';

  sendVoiceNoteBubble(duration);
}

function updateRecordingTimerDisplay() {
  const timerEl = document.getElementById('wa-recording-timer');
  if (timerEl) {
    timerEl.innerText = formatDuration(recordSeconds);
  }
}

function formatDuration(totalSecs) {
  const mins = Math.floor(totalSecs / 60);
  const secs = (totalSecs % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function sendVoiceNoteBubble(duration) {
  const time = getCurrentTimeString();
  const author = currentAuth.user?.name || 'Senior Designer';
  const session = consultationSessions[activeSessionId];

  if (session) {
    session.messages.push({
      type: 'audio',
      incoming: false,
      author,
      duration,
      time
    });
    session.preview = `🎙️ Voice note (${duration})`;
    session.time = time;
    renderContactsList();
    renderMessagesThread(session);
  }
}

function toggleAudioPlay(btn) {
  if (btn.innerText === '▶') {
    btn.innerText = '⏸';
  } else {
    btn.innerText = '▶';
  }
}

function getCurrentTimeString() {
  const d = new Date();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// =======================================================
// PRODUCTION ORDERS & SETTINGS & USERS
// =======================================================

async function loadProductionOrders() {
  try {
    const res = await fetch('/api/production/orders');
    const data = await res.json();
    const tbody = document.getElementById('production-tbody');
    if (!tbody || !data.orders) return;

    tbody.innerHTML = data.orders.map(order => `
      <tr>
        <td><strong>${order.customisation_id}</strong></td>
        <td>${order.shopify_order_number || '<span style="color:#888;">Pending Cart</span>'}</td>
        <td>
          <strong>${order.customer_name}</strong><br>
          <small style="color:#777;">${order.customer_email || ''}</small>
        </td>
        <td>
          ${order.product_name}<br>
          <span class="moa-tag moa-tag-gold">Size ${order.base_size}</span>
        </td>
        <td>
          <small>Height: ${order.measurements.height_cm}cm | Bust: ${order.measurements.bust_inches}" | Fit: ${order.fit_preference}</small><br>
          <small style="color:#8b5a2b;">Sleeve: +${order.alterations.sleeve_adjustment_inches}" | Length: +${order.alterations.length_adjustment_inches}"</small>
        </td>
        <td>
          <span class="moa-tag ${getStatusClass(order.status)}">${order.status}</span>
        </td>
        <td>
          <a href="/api/production/orders/${order.customisation_id}/sheet" target="_blank" class="moa-btn moa-btn-outline" style="text-decoration:none; display:inline-block; font-size:0.8rem; padding:4px 8px;">
            📄 Production Sheet
          </a>
        </td>
      </tr>
    `).join('');

    document.getElementById('badge-production').innerText = data.orders.length;
  } catch (err) {
    console.error('Failed to load production orders', err);
  }
}

function getStatusClass(status) {
  switch (status) {
    case 'IN_PRODUCTION': return 'moa-tag-warning';
    case 'COMPLETED': return 'moa-tag-gold';
    default: return 'moa-tag-gold';
  }
}

async function loadAddons() {
  try {
    const res = await fetch('/api/settings/addons');
    const result = await res.json();
    const container = document.getElementById('addons-container');
    if (!container || !result.data?.addons) return;

    container.innerHTML = result.data.addons.map(addon => `
      <div class="moa-addon-card">
        <div>
          <div class="moa-addon-header">
            <h4>${addon.name}</h4>
            <span class="moa-addon-price">+${addon.price} ${addon.currency}</span>
          </div>
          <p class="moa-addon-desc">${addon.description}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px solid #e6dfd5; padding-top: 0.75rem;">
          <span class="moa-tag ${addon.enabled ? 'moa-tag-gold' : ''}" style="background:${addon.enabled ? '#eef9f1' : '#f3f4f6'}; color:${addon.enabled ? '#166534' : '#6b7280'};">
            ${addon.enabled ? '✓ Enabled on PDP' : 'Disabled'}
          </span>
          <button class="moa-btn moa-btn-outline" style="font-size:0.75rem; padding:4px 8px;" onclick="deleteAddon('${addon.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load add-ons', err);
  }
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    const tbody = document.getElementById('users-tbody');
    if (!tbody || !data.users) return;

    allStaffUsers = data.users;

    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>
          <span class="moa-user-role-badge ${u.role === 'ADMIN' ? 'moa-role-admin' : u.role === 'SUB_ADMIN' ? 'moa-role-subadmin' : 'moa-role-designer'}">
            ${u.role === 'ADMIN' ? 'ADMIN (Full Access)' : u.role === 'SUB_ADMIN' ? 'SUB-ADMIN' : 'SENIOR DESIGNER (Chat Only)'}
          </span>
        </td>
        <td>
          <span class="moa-tag moa-tag-gold" style="background:#eef9f1; color:#166534;">${u.status}</span>
        </td>
        <td><small style="color:#777;">${new Date(u.createdAt).toLocaleDateString()}</small></td>
        <td>
          <select onchange="updateUserRole('${u.id}', this.value)" style="padding:4px 8px; font-size:0.8rem; border-radius:4px; border:1px solid #ddd;">
            <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
            <option value="SUB_ADMIN" ${u.role === 'SUB_ADMIN' ? 'selected' : ''}>Sub-Admin</option>
            <option value="SENIOR_DESIGNER" ${u.role === 'SENIOR_DESIGNER' ? 'selected' : ''}>Senior Designer (Chat Only)</option>
          </select>
          ${u.id !== currentAuth.user?.id ? `
            <button class="moa-btn moa-btn-outline" style="padding:4px 8px; font-size:0.75rem; color:#dc2626; margin-left:6px;" onclick="deleteUser('${u.id}')">Remove</button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load users', err);
  }
}

function openNewAddonModal() {
  document.getElementById('addon-form').reset();
  document.getElementById('addon-modal').style.display = 'flex';
}

function closeAddonModal() {
  document.getElementById('addon-modal').style.display = 'none';
}

async function handleSaveAddon(e) {
  e.preventDefault();
  const name = document.getElementById('addon-name-input').value;
  const description = document.getElementById('addon-desc-input').value;
  const price = document.getElementById('addon-price-input').value;
  const enabled = document.getElementById('addon-enabled-input').value === 'true';

  try {
    const res = await fetch('/api/settings/addons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addon: { name, description, price, enabled, currency: 'AED' }
      })
    });
    if (res.ok) {
      closeAddonModal();
      loadAddons();
    }
  } catch (err) {
    console.error('Failed to save add-on', err);
  }
}

async function deleteAddon(id) {
  if (!confirm('Are you sure you want to remove this custom add-on?')) return;
  try {
    const res = await fetch(`/api/settings/addons/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadAddons();
    }
  } catch (err) {
    console.error('Failed to delete add-on', err);
  }
}

function openNewUserModal() {
  document.getElementById('user-form').reset();
  document.getElementById('user-modal').style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

async function handleSaveUser(e) {
  e.preventDefault();
  const name = document.getElementById('user-name-input').value;
  const email = document.getElementById('user-email-input').value;
  const role = document.getElementById('user-role-input').value;

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });
    if (res.ok) {
      closeUserModal();
      loadUsers();
    }
  } catch (err) {
    console.error('Failed to save user', err);
  }
}

async function updateUserRole(userId, newRole) {
  try {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    if (res.ok) {
      loadUsers();
    }
  } catch (err) {
    console.error('Failed to update role', err);
  }
}

async function deleteUser(userId) {
  if (!confirm('Are you sure you want to remove this team member?')) return;
  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      loadUsers();
    }
  } catch (err) {
    console.error('Failed to delete user', err);
  }
}

// =======================================================
// TAB NAVIGATION & SWITCHING
// =======================================================
function initTabs() {
  const navBtns = document.querySelectorAll('.moa-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');
      if (!targetTabId) return;

      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const panes = document.querySelectorAll('.moa-tab-pane');
      panes.forEach(p => p.classList.remove('active'));

      const targetPane = document.getElementById(targetTabId);
      if (targetPane) {
        targetPane.classList.add('active');
        if (targetTabId === 'tab-ai-training') {
          loadAiTrainingSpec();
        }
      }
    });
  });
}

// =======================================================
// AI TRAINING CENTRE & SPECIFICATION (Section 11, 18 & 21)
// =======================================================
let currentTrainingSpec = null;

async function loadAiTrainingSpec() {
  try {
    const res = await fetch('/api/ai/training-spec');
    const data = await res.json();
    if (data.success) {
      currentTrainingSpec = data;
      
      const badge = document.getElementById('ai-model-badge');
      if (badge) badge.innerText = `${data.provider.toUpperCase()} (${data.modelName})`;

      const textarea = document.getElementById('ai-system-prompt-textarea');
      if (textarea) {
        textarea.value = data.customPromptOverride || data.systemPrompt;
      }

      renderTrainingScenarios(data.trainingScenarios || []);
    }
  } catch (err) {
    console.error('Failed to load AI training spec', err);
  }
}

function renderTrainingScenarios(scenarios) {
  const grid = document.getElementById('training-scenarios-grid');
  if (!grid) return;

  grid.innerHTML = scenarios.map(s => `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="font-size:0.8rem; color:#8b5a2b;">${s.scenario}</strong>
        <span class="role-badge role-subadmin" style="font-size:0.68rem;">${s.intent || 'TRAINING'}</span>
      </div>
      <div style="background:#ffffff; border-radius:6px; padding:6px 8px; border:1px solid #e2e8f0; margin-bottom:6px; font-size:0.78rem;">
        <span style="color:#64748b; font-weight:700;">Customer:</span> "${s.customer_message}"
      </div>
      <div style="background:#ecfdf5; border-radius:6px; padding:6px 8px; border:1px solid #a7f3d0; font-size:0.78rem; color:#065f46;">
        <span style="font-weight:700;">AI Stylist:</span> "${s.ideal_response}"
      </div>
      ${s.rules && s.rules.length ? `
        <div style="margin-top:6px; font-size:0.7rem; color:#64748b;">
          ${s.rules.map(r => `• ${r}`).join('<br>')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function saveCustomPromptOverride() {
  const textarea = document.getElementById('ai-system-prompt-textarea');
  if (!textarea) return;

  const customPrompt = textarea.value.trim();
  try {
    const res = await fetch('/api/ai/training-spec', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPromptOverride: customPrompt })
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ AI Training Specification and Master Prompt saved successfully!');
    }
  } catch (err) {
    console.error('Failed to save training config', err);
    alert('Failed to save prompt configuration');
  }
}

async function resetPromptToDefault() {
  if (!confirm('Reset Master Prompt to factory default training spec?')) return;
  try {
    await fetch('/api/ai/training-spec', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPromptOverride: null })
    });
    await loadAiTrainingSpec();
  } catch (err) {
    console.error('Failed to reset prompt', err);
  }
}

function setPlaygroundInput(text) {
  const input = document.getElementById('playground-user-input');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function runPlaygroundTest() {
  const input = document.getElementById('playground-user-input');
  const outContainer = document.getElementById('playground-output-container');
  const btn = document.getElementById('btn-run-playground');
  if (!input || !outContainer) return;

  const userMessage = input.value.trim();
  if (!userMessage) return;

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Evaluating...';
  }

  outContainer.innerHTML = `
    <div style="text-align:center; padding:20px; color:#64748b;">
      <span class="spinner-small" style="display:inline-block; margin-right:6px;"></span>
      Gemini AI is analyzing customer intent and evaluating atelier response...
    </div>
  `;

  try {
    const res = await fetch('/api/ai/test-turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage,
        productTitle: 'Royal Silk Velvet Abaya',
        productCategory: 'occasion_luxury'
      })
    });

    const data = await res.json();
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Test AI';
    }

    if (data.success && data.result) {
      const r = data.result;
      const intent = r.intent || 'GENERAL';
      const extractedHeight = r.extractedHeightCm ? `${r.extractedHeightCm} cm` : 'Not provided';
      const extractedBust = r.extractedBustInches ? `${r.extractedBustInches}"` : 'Not provided';
      const fit = r.fitPreference ? r.fitPreference.toUpperCase() : 'Not provided';
      const addOns = r.customRequests && r.customRequests.length ? r.customRequests.join(', ') : 'None';
      const isComplete = r.isComplete ? '✅ Complete (Ready for in-chat card)' : '⏳ Incomplete (Guiding customer)';
      const escalation = r.requiresEscalation ? `🚨 Escalate: ${r.escalationReason || 'Senior review'}` : '✅ AI Handling';

      outContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="role-badge role-admin" style="font-size:0.72rem;">Intent: ${intent}</span>
          <span style="font-size:0.75rem; color:#64748b;">${isComplete} • ${escalation}</span>
        </div>
        <div style="background:#ffffff; border-radius:6px; padding:10px; border:1px solid #cbd5e1; margin-bottom:8px; font-size:0.85rem; line-height:1.45; color:#1e293b;">
          <strong style="color:#8b5a2b;">AI Stylist Reply:</strong><br>
          ${r.replyMessage}
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:6px; font-size:0.72rem; color:#475569;">
          <div class="metric-chip">Height: <strong>${extractedHeight}</strong></div>
          <div class="metric-chip">Bust: <strong>${extractedBust}</strong></div>
          <div class="metric-chip">Fit: <strong>${fit}</strong></div>
          <div class="metric-chip">Add-Ons: <strong>${addOns}</strong></div>
        </div>
      `;
    } else {
      outContainer.innerHTML = `<div style="color:#ef4444; padding:10px;">Error: ${data.error || 'Failed to evaluate prompt'}</div>`;
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🚀 Test AI';
    }
    outContainer.innerHTML = `<div style="color:#ef4444; padding:10px;">Network error connecting to AI evaluation endpoint.</div>`;
  }
}
