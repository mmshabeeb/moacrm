import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Authenticate with email & password
 */
authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide both email and password'
    });
  }

  const result = authService.login(email, password);
  if (!result.success) {
    return res.status(401).json({
      success: false,
      error: result.error
    });
  }

  return res.json({
    success: true,
    message: 'Login successful',
    token: result.session?.token,
    user: result.session?.user,
    permissions: result.permissions
  });
});

/**
 * GET /api/auth/me
 * Validate active session token and return user profile
 */
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.query.token as string);

  if (!token) {
    return res.status(401).json({ success: false, error: 'No authentication token provided' });
  }

  const result = authService.validateSession(token);
  if (!result.valid) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid' });
  }

  return res.json({
    success: true,
    user: result.user,
    permissions: result.permissions
  });
});

/**
 * POST /api/auth/logout
 * Invalidate active session token
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : req.body.token;

  if (token) {
    authService.logout(token);
  }

  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

/**
 * POST /api/auth/change-password
 * Update password for a user
 */
authRouter.post('/change-password', (req: Request, res: Response) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
  }

  const result = authService.resetUserPassword(userId, newPassword);
  return res.json(result);
});
