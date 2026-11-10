import { AsyncLocalStorage } from 'node:async_hooks';
import type { Types } from 'mongoose';

type Ctx = { tenantId?: Types.ObjectId; bypass?: boolean };
const als = new AsyncLocalStorage<Ctx>();

/** Run `fn` with every tenant-scoped query automatically filtered to `tenantId`. */
export const runInTenant = <T>(tenantId: Types.ObjectId, fn: () => T): T => als.run({ tenantId }, fn);

/** Run `fn` with tenant scoping disabled. Only for platform/super-admin code paths. */
export const runAsPlatform = <T>(fn: () => T): T => als.run({ bypass: true }, fn);

export const currentTenantId = () => als.getStore()?.tenantId;
export const isPlatformContext = () => Boolean(als.getStore()?.bypass);
