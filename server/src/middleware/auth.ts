import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../lib/http.js';
import { runAsPlatform } from '../lib/tenantContext.js';
import { User } from '../models/user.js';
import { PlatformUser } from '../models/platform.js';
import { can, permissionsFor, type Permission, type Role } from '../auth/permissions.js';

export type TenantTokenPayload = { sub: string; tid: string; ver: number; typ: 'tenant'; imp?: string };
export type PlatformTokenPayload = { sub: string; ver: number; typ: 'platform' };

export type AuthUser = { _id: string; name: string; email: string; role: Role; member?: string; impersonatedBy?: string };

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    platformUser?: { _id: string; name: string; email: string };
  }
}

export const signTenantToken = (p: Omit<TenantTokenPayload, 'typ'>, expiresIn = env().JWT_EXPIRES) =>
  jwt.sign({ ...p, typ: 'tenant' }, env().JWT_SECRET, { expiresIn: expiresIn as any, audience: 'tenant' });

export const signPlatformToken = (p: Omit<PlatformTokenPayload, 'typ'>) =>
  jwt.sign({ ...p, typ: 'platform' }, env().JWT_SECRET, { expiresIn: '8h', audience: 'platform' });

const bearer = (req: Request) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

/** Staff / member authentication. The token is only valid for the gym it was issued by. */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw new ApiError(401, 'Please sign in');
  let payload: TenantTokenPayload;
  try {
    payload = jwt.verify(token, env().JWT_SECRET, { audience: 'tenant' }) as TenantTokenPayload;
  } catch {
    throw new ApiError(401, 'Your session has expired, please sign in again');
  }
  if (payload.typ !== 'tenant' || payload.tid !== req.tenant?._id) throw new ApiError(401, 'Session is not valid for this gym');
  const user = await User.findById(payload.sub).lean();
  if (!user || user.status !== 'active' || user.tokenVersion !== payload.ver) throw new ApiError(401, 'Your session is no longer valid');
  req.user = {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    member: user.member ? String(user.member) : undefined,
    impersonatedBy: payload.imp,
  };
  next();
});

/** Require one of the listed permissions (any). */
export const requirePermission =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'Please sign in'));
    if (!perms.some((p) => can(req.user!.role, p))) return next(new ApiError(403, 'You do not have permission to do this'));
    next();
  };

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, 'Please sign in'));
    if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to do this'));
    next();
  };

export const userPermissions = (role: Role) => permissionsFor(role);

/** Vendor super-admin authentication (no tenant scope). */
export const protectPlatform = asyncHandler(async (req, _res, next) => {
  const token = bearer(req);
  if (!token) throw new ApiError(401, 'Please sign in');
  let payload: PlatformTokenPayload;
  try {
    payload = jwt.verify(token, env().JWT_SECRET, { audience: 'platform' }) as PlatformTokenPayload;
  } catch {
    throw new ApiError(401, 'Your session has expired, please sign in again');
  }
  if (payload.typ !== 'platform') throw new ApiError(401, 'Invalid session');
  const u = await runAsPlatform(() => PlatformUser.findById(payload.sub).lean());
  if (!u || u.tokenVersion !== payload.ver) throw new ApiError(401, 'Your session is no longer valid');
  req.platformUser = { _id: String(u._id), name: u.name, email: u.email };
  next();
});
