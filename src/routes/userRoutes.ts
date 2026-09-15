import { Router, Request, Response } from 'express';
import { UserRole } from '../models/user';
import { authService } from '../services/authService';

export const userRouter = Router();

/**
 * GET /api/users
 * List all users
 */
userRouter.get('/', (req: Request, res: Response) => {
  const users = authService.getAllUsers();
  res.json({
    success: true,
    count: users.length,
    users
  });
});

/**
 * POST /api/users
 * Create new user with email, name, role and initial password
 */
userRouter.post('/', (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  const result = authService.createUser({
    name,
    email,
    password,
    role: role as UserRole
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'User created successfully',
    user: result.user,
    users: authService.getAllUsers()
  });
});

/**
 * PATCH /api/users/:id/role
 * Update user role or status
 */
userRouter.patch('/:id/role', (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, status } = req.body;

  const result = authService.updateUserRole(id, role as UserRole, status);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }

  res.json({
    success: true,
    message: 'User updated successfully',
    user: result.user,
    users: authService.getAllUsers()
  });
});

/**
 * POST /api/users/:id/reset-password
 * Reset user password by Admin
 */
userRouter.post('/:id/reset-password', (req: Request, res: Response) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const result = authService.resetUserPassword(id, newPassword);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }

  res.json({ success: true, message: 'Password reset successfully' });
});

/**
 * DELETE /api/users/:id
 * Remove user
 */
userRouter.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = authService.deleteUser(id);
  if (!result.success) {
    return res.status(404).json({ error: result.error });
  }

  res.json({ success: true, message: 'User removed', users: authService.getAllUsers() });
});
