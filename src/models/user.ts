export type UserRole = 'ADMIN' | 'SUB_ADMIN' | 'SENIOR_DESIGNER';

export interface MOAUser {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  salt?: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  lastActive: string;
  createdAt: string;
}

export interface UserSession {
  token: string;
  user: Omit<MOAUser, 'passwordHash' | 'salt'>;
  expiresAt: string;
}

export interface AuthContext {
  currentUser: Omit<MOAUser, 'passwordHash' | 'salt'>;
  permissions: {
    canAccessConsultations: boolean;
    canAccessProduction: boolean;
    canAccessSettings: boolean;
    canManageUsers: boolean;
    canAccessSizeMatrix: boolean;
    canViewAllStaffChats: boolean;
    canTakeoverAnyChat: boolean;      // Admin & Sub-Admin can override & take over active designer chats
    canTakeoverUnassigned: boolean;    // All staff can take over unassigned chats
    canTransferToAnyone: boolean;      // Admin & Sub-Admin can transfer to anybody
    canTransferToDesigners: boolean;   // Senior Designer can transfer to other designers
    canMoveToUnassigned: boolean;      // Anybody can move chat back to unassigned box
  };
}

export function getRolePermissions(role: UserRole) {
  if (role === 'ADMIN') {
    return {
      canAccessConsultations: true,
      canAccessProduction: true,
      canAccessSettings: true,
      canManageUsers: true,
      canAccessSizeMatrix: true,
      canViewAllStaffChats: true,
      canTakeoverAnyChat: true,
      canTakeoverUnassigned: true,
      canTransferToAnyone: true,
      canTransferToDesigners: true,
      canMoveToUnassigned: true
    };
  }

  if (role === 'SUB_ADMIN') {
    return {
      canAccessConsultations: true,
      canAccessProduction: true,
      canAccessSettings: true,
      canManageUsers: false,
      canAccessSizeMatrix: true,
      canViewAllStaffChats: true,
      canTakeoverAnyChat: true,
      canTakeoverUnassigned: true,
      canTransferToAnyone: true,
      canTransferToDesigners: true,
      canMoveToUnassigned: true
    };
  }
  
  // SENIOR_DESIGNER is Chat-Only with designer transfer & unassign rights
  return {
    canAccessConsultations: true,
    canAccessProduction: false,
    canAccessSettings: false,
    canManageUsers: false,
    canAccessSizeMatrix: false,
    canViewAllStaffChats: false,
    canTakeoverAnyChat: false, // Cannot takeover another designer's active chat
    canTakeoverUnassigned: true, // Can takeover any unassigned chat
    canTransferToAnyone: false, // Cannot transfer to admin/subadmin
    canTransferToDesigners: true, // Can transfer to another designer
    canMoveToUnassigned: true // Can move back to unassigned at any time
  };
}
