import crypto from 'crypto';
import { MOAUser, UserRole, UserSession, getRolePermissions } from '../models/user';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class AuthService {
  private users: MOAUser[] = [];
  private sessions: Map<string, UserSession> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    const defaultAccounts = [
      {
        id: 'user_admin_1',
        name: 'Fatima Al-Nuaimi',
        email: 'admin@mallofabayas.com',
        password: 'Admin@MOA2026',
        role: 'ADMIN' as UserRole
      },
      {
        id: 'user_subadmin_1',
        name: 'Noura Al-Kuwari',
        email: 'noura.subadmin@mallofabayas.com',
        password: 'SubAdmin@MOA2026',
        role: 'SUB_ADMIN' as UserRole
      },
      {
        id: 'user_designer_1',
        name: 'Aisha Designer',
        email: 'aisha.designer@mallofabayas.com',
        password: 'Designer@MOA2026',
        role: 'SENIOR_DESIGNER' as UserRole
      },
      {
        id: 'user_designer_2',
        name: 'Mariam Senior Tailor',
        email: 'mariam.consultant@mallofabayas.com',
        password: 'Tailor@MOA2026',
        role: 'SENIOR_DESIGNER' as UserRole
      }
    ];

    for (const acc of defaultAccounts) {
      const salt = generateSalt();
      const passwordHash = hashPassword(acc.password, salt);
      this.users.push({
        id: acc.id,
        name: acc.name,
        email: acc.email.toLowerCase().trim(),
        passwordHash,
        salt,
        role: acc.role,
        status: 'ACTIVE',
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
    }
  }

  public login(email: string, password: string): { success: boolean; session?: UserSession; error?: string; permissions?: any } {
    const cleanEmail = (email || '').toLowerCase().trim();
    const user = this.users.find(u => u.email === cleanEmail);

    if (!user) {
      return { success: false, error: 'Invalid email address or password' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'Account is deactivated. Please contact an administrator.' };
    }

    if (!user.salt || !user.passwordHash) {
      return { success: false, error: 'Account password is not set' };
    }

    const calculatedHash = hashPassword(password, user.salt);
    if (calculatedHash !== user.passwordHash) {
      return { success: false, error: 'Invalid email address or password' };
    }

    user.lastActive = new Date().toISOString();

    const token = `moa_auth_${crypto.randomBytes(32).toString('hex')}`;
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      lastActive: user.lastActive,
      createdAt: user.createdAt
    };

    const session: UserSession = {
      token,
      user: safeUser,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };

    this.sessions.set(token, session);

    return {
      success: true,
      session,
      permissions: getRolePermissions(user.role)
    };
  }

  public validateSession(token: string): { valid: boolean; user?: Omit<MOAUser, 'passwordHash' | 'salt'>; permissions?: any } {
    if (!token) return { valid: false };

    const session = this.sessions.get(token);
    if (!session) return { valid: false };

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      return { valid: false };
    }

    const user = this.users.find(u => u.id === session.user.id);
    if (!user || user.status !== 'ACTIVE') {
      this.sessions.delete(token);
      return { valid: false };
    }

    user.lastActive = new Date().toISOString();

    return {
      valid: true,
      user: session.user,
      permissions: getRolePermissions(user.role)
    };
  }

  public logout(token: string): boolean {
    if (!token) return false;
    return this.sessions.delete(token);
  }

  public getAllUsers(): Array<Omit<MOAUser, 'passwordHash' | 'salt'>> {
    return this.users.map(({ passwordHash, salt, ...safeUser }) => safeUser);
  }

  public createUser(data: { name: string; email: string; password?: string; role: UserRole }): { success: boolean; user?: any; error?: string } {
    const cleanEmail = (data.email || '').toLowerCase().trim();
    if (this.users.some(u => u.email === cleanEmail)) {
      return { success: false, error: 'A user with this email already exists' };
    }

    const salt = generateSalt();
    const rawPassword = data.password || 'MOAAtelier@2026';
    const passwordHash = hashPassword(rawPassword, salt);

    const newUser: MOAUser = {
      id: `user_${Date.now()}`,
      name: data.name.trim(),
      email: cleanEmail,
      passwordHash,
      salt,
      role: data.role,
      status: 'ACTIVE',
      lastActive: 'Never',
      createdAt: new Date().toISOString()
    };

    this.users.push(newUser);
    const { passwordHash: _, salt: __, ...safeUser } = newUser;
    return { success: true, user: safeUser };
  }

  public updateUserRole(userId: string, role?: UserRole, status?: 'ACTIVE' | 'INACTIVE'): { success: boolean; user?: any; error?: string } {
    const user = this.users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    if (role) user.role = role;
    if (status) user.status = status;

    const { passwordHash, salt, ...safeUser } = user;
    return { success: true, user: safeUser };
  }

  public resetUserPassword(userId: string, newPassword: string): { success: boolean; error?: string } {
    const user = this.users.find(u => u.id === userId);
    if (!user) return { success: false, error: 'User not found' };

    const salt = generateSalt();
    user.salt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    return { success: true };
  }

  public deleteUser(userId: string): { success: boolean; error?: string } {
    const index = this.users.findIndex(u => u.id === userId);
    if (index === -1) return { success: false, error: 'User not found' };
    this.users.splice(index, 1);
    return { success: true };
  }
}

export const authService = new AuthService();
