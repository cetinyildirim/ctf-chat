import type { NextFunction, Request, Response } from 'express';
import { can, canAny, type Permission, type Role } from '@sydt/shared';
import { Forbidden, Unauthorized } from '../lib/http-error.js';

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Unauthorized());
      return;
    }
    const role = req.user.role as Role;
    const ok = permissions.every((p) => can(role, p));
    if (!ok) {
      next(Forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Unauthorized());
      return;
    }
    const role = req.user.role as Role;
    if (!canAny(role, ...permissions)) {
      next(Forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(Unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(Forbidden());
      return;
    }
    next();
  };
}
