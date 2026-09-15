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
let activeSessionId = 'MOA-CUS-10482';
let activeAISessionId = 'MOA-CUS-10250';

// Voice Recording State Machine
let recordingState = 'IDLE'; // 'IDLE' | 'RECORDING' | 'PAUSED'
let recordTimer = null;
let recordSeconds = 0;

// Cached Staff Users
let allStaffUsers = [];

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
  const authScreen = document.getElementById('moa-auth-screen');

  if (!token) {
    if (authScreen) authScreen.classList.remove('moa-auth-hidden');
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
      if (authScreen) authScreen.classList.add('moa-auth-hidden');
      return true;
    } else {
      localStorage.removeItem('moa_crm_token');
      if (authScreen) authScreen.classList.remove('moa-auth-hidden');
      return false;
    }
  } catch (err) {
    console.error('Failed to validate session token', err);
    if (authScreen) authScreen.classList.remove('moa-auth-hidden');
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
  const authScreen = document.getElementById('moa-auth-screen');
  if (authScreen) {
    authScreen.classList.remove('moa-auth-hidden');
    const pwdInput = document.getElementById('login-password');
    if (pwdInput) pwdInput.value = '';
    const alert = document.getElementById('auth-error-alert');
    if (alert) alert.style.display = 'none';
  }
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

const consultationSessions = {
  'MOA-CUS-10495': {
    id: 'MOA-CUS-10495',
    name: 'Zara Al-Hashemi',
    orderNumber: '#10495',
    avatar: 'Z',
    avatarColor: '#7c3aed',
    product: 'Royal Silk Velvet Abaya – Emerald',
    baseSize: '54',
    height: '160 cm',
    bust: '36"',
    fit: 'Regular Flared',
    sleeve: '+1.5" (Heels)',
    status: 'online • waiting in unassigned queue',
    time: '15:10',
    preview: 'I will wear 3-inch heels, could you adjust length to 55.5 inches?',
    unread: 2,
    claimedBy: null,
    claimedById: null,
    claimedByRole: null,
    isAIHandling: false,
    messages: [
      {
        type: 'text',
        incoming: true,
        author: 'Zara Al-Hashemi',
        text: "Salam! I'm ordering the Royal Silk Velvet Abaya for my sister's wedding. I need advice on length with heels.",
        time: '15:05'
      },
      {
        type: 'text',
        incoming: false,
        author: 'MOA AI Designer',
        text: "Wa alaykum assalam Zara! For your height of 160 cm, standard size 54 finishes at 54 inches. With 3-inch heels, we recommend extending length by +1.5 inches to 55.5\".",
        time: '15:07',
        ticks: '✓✓'
      },
      {
        type: 'text',
        incoming: true,
        author: 'Zara Al-Hashemi',
        text: "That's perfect! Also can we add side pockets and a hidden feeding zipper?",
        time: '15:08'
      },
      {
        type: 'text',
        incoming: false,
        author: 'MOA AI Designer',
        text: "Yes absolutely. Side seam pockets (+15 AED) and hidden maternity zipper (+25 AED) can be integrated seamlessly into the design.",
        time: '15:09',
        ticks: '✓✓'
      },
      {
        type: 'text',
        incoming: true,
        author: 'Zara Al-Hashemi',
        text: "I will wear 3-inch heels, could you adjust length to 55.5 inches and confirm the cuff width?",
        time: '15:10'
      },
      {
        type: 'system',
        text: '⏳ Transferred by AI to Unassigned Queue for bespoke heel length & cuff verification'
      }
    ]
  },
  'MOA-CUS-10482': {
    id: 'MOA-CUS-10482',
    name: 'Sarah Al-Mansoor',
    orderNumber: '#10482',
    avatar: 'S',
    avatarColor: '#00a884',
    product: "Linen Grace – Mom's Modest Set",
    baseSize: '56',
    height: '165 cm',
    bust: '38"',
    fit: 'Extra Loose',
    sleeve: '+2" (Loose)',
    status: 'online • waiting in unassigned queue',
    time: '14:52',
    preview: 'Can you make the sleeves 2 inches longer with extra room around arms?',
    unread: 1,
    claimedBy: null,
    claimedById: null,
    claimedByRole: null,
    isAIHandling: false,
    messages: [
      {
        type: 'text',
        incoming: true,
        author: 'Sarah Al-Mansoor',
        text: 'Hi! I want this Linen Grace Modest Set in an extra loose fit. My height is 165 cm, bust 38 inches, and can you make the sleeves 2 inches longer with extra room around arms?',
        time: '14:50'
      },
      {
        type: 'text',
        incoming: false,
        author: 'MOA AI Designer',
        text: "Of course Sarah! At 165 cm, size 56 is your baseline reference. I've noted an extra loose drape with +2\" sleeve extension and extra armhole ease.",
        time: '14:51',
        ticks: '✓✓'
      },
      {
        type: 'image',
        incoming: true,
        author: 'Sarah Al-Mansoor',
        imgSrc: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&q=80',
        text: 'Here is the sleeve cuff style I liked from your collection!',
        time: '14:52'
      },
      {
        type: 'audio',
        incoming: true,
        author: 'Sarah Al-Mansoor',
        duration: '0:14',
        time: '14:53'
      },
      {
        type: 'system',
        text: '⏳ Transferred by AI to Unassigned Queue for cuff style review'
      }
    ]
  },
  'MOA-CUS-10398': {
    id: 'MOA-CUS-10398',
    name: 'Maryam (Dubai)',
    orderNumber: '#10398',
    avatar: 'M',
    avatarColor: '#5c6bc0',
    product: 'Noor Pleated Bisht – Desert Pearl',
    baseSize: '58',
    height: '170 cm',
    bust: '40"',
    fit: 'Tailored Modest',
    sleeve: 'Standard (28")',
    status: 'online • live consultation',
    time: '13:20',
    preview: '✓✓ Customisation confirmed: Size 58',
    unread: 0,
    claimedBy: 'Aisha Designer',
    claimedById: 'user_designer_1',
    claimedByRole: 'SENIOR_DESIGNER',
    isAIHandling: false,
    messages: [
      {
        type: 'text',
        incoming: true,
        author: 'Maryam (Dubai)',
        text: 'Hello, what size would you recommend for 170 cm height and 40 inches bust?',
        time: '11:20'
      },
      {
        type: 'text',
        incoming: false,
        author: 'MOA AI Designer',
        text: 'Marhaba Maryam! Based on 170 cm and 40" bust, your recommended baseline is Size 58 for an elegant drape.',
        time: '11:22',
        ticks: '✓✓'
      },
      {
        type: 'system',
        text: '🔵 Aisha Designer took over the consultation'
      },
      {
        type: 'text',
        incoming: false,
        author: 'Aisha Designer',
        text: 'Salam Maryam! I am Aisha from the tailoring team. I reviewed your 170 cm height and pleated bisht drape—Size 58 will fit gorgeously.',
        time: '11:24',
        ticks: '✓✓'
      },
      {
        type: 'text',
        incoming: true,
        author: 'Maryam (Dubai)',
        text: 'Thank you Aisha! Can I confirm this customisation?',
        time: '11:25'
      }
    ]
  },
  'MOA-CUS-10250': {
    id: 'MOA-CUS-10250',
    name: 'Huda (Riyadh)',
    orderNumber: '#10250',
    avatar: 'H',
    avatarColor: '#d97706',
    product: 'Classic Nidha Butterfly Abaya',
    baseSize: '54',
    height: '158 cm',
    bust: '34"',
    fit: 'Regular Flared',
    sleeve: 'Standard (27")',
    status: 'online • chatting with AI Designer on PDP',
    time: '12:05',
    preview: 'What is the chest measurement for size 54?',
    unread: 0,
    claimedBy: null,
    claimedById: null,
    claimedByRole: null,
    isAIHandling: true,
    messages: [
      {
        type: 'text',
        incoming: true,
        author: 'Huda (Riyadh)',
        text: 'Salam, what is the chest circumference for size 54 in the Butterfly cut?',
        time: '12:04'
      },
      {
        type: 'text',
        incoming: false,
        author: 'MOA AI Designer',
        text: 'Wa alaykum assalam Huda! For Size 54, the flat bust width is 22 inches (44 inches circumference) with extra butterfly flutter ease.',
        time: '12:05',
        ticks: '✓✓'
      }
    ]
  }
};

function initConsultations() {
  updateCategoryCounts();
  renderContactsList();
  loadSessionDetail(activeSessionId);
}

function initAIChats() {
  renderAIContactsList();
  loadAISessionDetail(activeAISessionId);
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
