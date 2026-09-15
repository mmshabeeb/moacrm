import { Router, Request, Response } from 'express';
import { MOAUser, UserRole, getRolePermissions } from '../models/user';

export const userRouter = Router();

// In-memory seed users
let usersDb: MOAUser[] = [
  {
    id: 'user_admin_1',
    name: 'Fatima Al-Nuaimi',
    email: 'fatima.admin@mallofabayas.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    lastActive: new Date().toISOString(),
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    id: 'user_subadmin_1',
    name: 'Noura Al-Kuwari',
    email: 'noura.subadmin@mallofabayas.com',
    role: 'SUB_ADMIN',
    status: 'ACTIVE',
    lastActive: new Date().toISOString(),
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    id: 'user_designer_1',
    name: 'Aisha Designer',
    email: 'aisha.designer@mallofabayas.com',
    role: 'SENIOR_DESIGNER',
    status: 'ACTIVE',
    lastActive: new Date().toISOString(),
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
  },
  {
    id: 'user_designer_2',
    name: 'Mariam Senior Tailor',
    email: 'mariam.consultant@mallofabayas.com',
    role: 'SENIOR_DESIGNER',
    status: 'ACTIVE',
    lastActive: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
  }
];

let currentActiveUser: MOAUser = usersDb[0]; // Default to Admin

/**
 * GET /api/users/current
 * Get current session user and active permissions
 */
userRouter.get('/current', (req: Request, res: Response) => {
  res.json({
    success: true,
    user: currentActiveUser,
    permissions: getRolePermissions(currentActiveUser.role)
  });
});

/**
 * POST /api/users/switch-user
 * Switch active role / user (for testing & role demonstration)
 */
userRouter.post('/switch-user', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = usersDb.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  currentActiveUser = user;
  res.json({
    success: true,
    message: `Switched user to ${user.name} (${user.role})`,
    user: currentActiveUser,
    permissions: getRolePermissions(currentActiveUser.role)
  });
});

/**
 * GET /api/users
 * List all users (Admin only)
 */
userRouter.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    count: usersDb.length,
    users: usersDb
  });
});

/**
 * POST /api/users
 * Create new user (Admin only)
 */
userRouter.post('/', (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  const newUser: MOAUser = {
    id: `user_${Date.now()}`,
    name,
    email,
    role: (role === 'ADMIN' ? 'ADMIN' : 'SENIOR_DESIGNER') as UserRole,
    status: 'ACTIVE',
    lastActive: 'Never',
    createdAt: new Date().toISOString()
  };

  usersDb.push(newUser);
  res.json({ success: true, message: 'User created successfully', user: newUser, users: usersDb });
});

/**
 * PATCH /api/users/:id/role
 * Update user role
 */
userRouter.patch('/:id/role', (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, status } = req.body;

  const user = usersDb.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (role) user.role = role as UserRole;
  if (status) user.status = status;

  res.json({ success: true, message: 'User updated', user, users: usersDb });
});

/**
 * DELETE /api/users/:id
 * Delete or deactivate user
 */
userRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  if (id === currentActiveUser.id) {
    return res.status(400).json({ error: 'Cannot delete currently active user' });
  }

  usersDb = usersDb.filter(u => u.id !== id);
  res.json({ success: true, message: 'User removed', users: usersDb });
});
