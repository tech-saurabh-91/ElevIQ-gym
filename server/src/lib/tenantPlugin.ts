import { Schema, Types } from 'mongoose';
import { currentTenantId, isPlatformContext } from './tenantContext.js';

const QUERY_OPS = [
  'countDocuments', 'deleteMany', 'deleteOne', 'distinct', 'find', 'findOne',
  'findOneAndDelete', 'findOneAndReplace', 'findOneAndUpdate', 'replaceOne', 'updateMany', 'updateOne',
] as const;

class TenantScopeError extends Error {
  status = 500;
  constructor(model: string) {
    super(`Tenant context missing for ${model} query`);
  }
}

/**
 * Data-layer tenant isolation. Every model using this plugin:
 *  - gets a required, indexed `tenantId`
 *  - has ALL queries/aggregations filtered by the current request's tenant
 *  - refuses to run at all if there is no tenant in context (fail closed)
 *  - refuses to save a document belonging to another tenant
 */
export function tenantPlugin(schema: Schema) {
  schema.add({ tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true, immutable: true } });

  for (const op of QUERY_OPS) {
    schema.pre(op as any, function (this: any) {
      if (isPlatformContext()) return;
      const tid = currentTenantId();
      if (!tid) throw new TenantScopeError(this.model?.modelName ?? 'unknown');
      this.where({ tenantId: tid });
      const update = this.getUpdate?.();
      if (update && typeof update === 'object') {
        delete (update as any).tenantId;
        if ((update as any).$set) delete (update as any).$set.tenantId;
        if ((update as any).$setOnInsert) (update as any).$setOnInsert.tenantId = tid;
        else if (this.getOptions?.().upsert) (update as any).$setOnInsert = { tenantId: tid };
      }
    });
  }

  schema.pre('aggregate', function () {
    if (isPlatformContext()) return;
    const tid = currentTenantId();
    if (!tid) throw new TenantScopeError((this as any)._model?.modelName ?? 'aggregate');
    this.pipeline().unshift({ $match: { tenantId: tid } });
  });

  schema.pre('validate', function () {
    if (isPlatformContext() && this.get('tenantId')) return;
    const tid = currentTenantId();
    if (!tid && !isPlatformContext()) throw new TenantScopeError((this.constructor as any).modelName);
    if (!this.get('tenantId')) this.set('tenantId', tid);
    else if (tid && !(this.get('tenantId') as Types.ObjectId).equals(tid)) {
      throw Object.assign(new Error('Cross-tenant write blocked'), { status: 403 });
    }
  });

  schema.pre('insertMany', function (next: () => void, docs: any[]) {
    const tid = currentTenantId();
    if (!tid && !isPlatformContext()) throw new TenantScopeError('insertMany');
    for (const d of docs) {
      if (!d.tenantId) d.tenantId = tid;
      else if (tid && String(d.tenantId) !== String(tid)) throw new Error('Cross-tenant write blocked');
    }
    next();
  });
}
