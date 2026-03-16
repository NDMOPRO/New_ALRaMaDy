import { Request, Response, NextFunction } from 'express';
import { authService, AuthError } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
    isOwner: boolean;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'NO_TOKEN',
    });
    return;
  }

  const token = authHeader.slice(7);

  authService
    .verifyToken(token)
    .then((payload) => {
      req.user = payload;
      next();
    })
    .catch((err) => {
      if (err instanceof AuthError) {
        res.status(401).json({
          success: false,
          error: err.message,
          code: err.code,
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN',
        });
      }
    });
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Owner bypasses all permission checks
    if (req.user.isOwner) {
      next();
      return;
    }

    const hasPermission = permissions.some((p) => req.user!.permissions.includes(p));
    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: permissions,
      });
      return;
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (req.user.isOwner) {
      next();
      return;
    }

    const hasRole = roles.some((r) => req.user!.roles.includes(r));
    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: 'Insufficient role',
        code: 'FORBIDDEN',
        required: roles,
      });
      return;
    }

    next();
  };
}

export function requireOwner(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  if (!req.user.isOwner) {
    res.status(403).json({
      success: false,
      error: 'Owner access required',
      code: 'OWNER_REQUIRED',
    });
    return;
  }

  next();
}
