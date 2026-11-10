import { Router, type Request, type RequestHandler } from 'express';
import type { Model, PopulateOptions } from 'mongoose';
import { z, type ZodObject, type ZodRawShape } from 'zod';
import { ApiError, asyncHandler, escapeRegex, pageParams, parse } from './http.js';
import { audit } from './util.js';

type Opts<S extends ZodRawShape> = {
  model: Model<any>;
  schema: ZodObject<S>;
  /** Query-string filters that are allowed, with their types. Anything else is ignored. */
  filters?: Record<string, z.ZodTypeAny>;
  searchable?: string[];
  populate?: (string | PopulateOptions)[];
  defaultSort?: string;
  sortable?: string[];
  read: RequestHandler[];
  write: RequestHandler[];
  remove?: RequestHandler[];
  entity: string;
  onChange?: (req: Request) => Promise<void> | void;
  /** Extra validation of the merged document (create + update). */
  check?: (doc: Record<string, any>) => string | null;
};

/** Validated, whitelisted, tenant-scoped (via the model plugin) REST resource. */
export function crudRouter<S extends ZodRawShape>(o: Opts<S>) {
  const r = Router();
  const sortable = new Set(o.sortable ?? ['createdAt']);

  r.get(
    '/',
    ...o.read,
    asyncHandler(async (req, res) => {
      const { page, limit, skip } = pageParams(req.query);
      const query: Record<string, unknown> = {};
      for (const [k, schema] of Object.entries(o.filters ?? {})) {
        const raw = req.query[k];
        if (raw === undefined || raw === '' || raw === 'all') continue;
        query[k] = parse(schema, raw);
      }
      if (o.searchable?.length && typeof req.query.q === 'string' && req.query.q.trim()) {
        const rx = new RegExp(escapeRegex(req.query.q.trim().slice(0, 80)), 'i');
        query.$or = o.searchable.map((f) => ({ [f]: rx }));
      }
      let sort = o.defaultSort ?? '-createdAt';
      if (typeof req.query.sort === 'string') {
        const field = req.query.sort.replace(/^-/, '');
        if (sortable.has(field)) sort = req.query.sort;
      }
      let cursor = o.model.find(query).sort(sort).skip(skip).limit(limit);
      for (const p of o.populate ?? []) cursor = cursor.populate(p as any);
      const [items, total] = await Promise.all([cursor.lean(), o.model.countDocuments(query)]);
      res.json({ success: true, data: items, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } });
    })
  );

  r.get(
    '/:id',
    ...o.read,
    asyncHandler(async (req, res) => {
      let q = o.model.findById(req.params.id);
      for (const p of o.populate ?? []) q = q.populate(p as any);
      const doc = await q.lean();
      if (!doc) throw new ApiError(404, `${o.entity} not found`);
      res.json({ success: true, data: doc });
    })
  );

  r.post(
    '/',
    ...o.write,
    asyncHandler(async (req, res) => {
      const body = parse(o.schema, req.body);
      const problem = o.check?.(body);
      if (problem) throw new ApiError(400, problem);
      const doc = await o.model.create(body);
      await audit(req, 'create', o.entity, doc._id);
      await o.onChange?.(req);
      res.status(201).json({ success: true, data: doc });
    })
  );

  r.put(
    '/:id',
    ...o.write,
    asyncHandler(async (req, res) => {
      const body = parse(o.schema.partial(), req.body);
      // Remove defaults that .partial() would otherwise inject for omitted fields.
      for (const k of Object.keys(body)) if (!(k in (req.body ?? {}))) delete (body as any)[k];
      if (o.check) {
        const existing = await o.model.findById(req.params.id).lean();
        if (!existing) throw new ApiError(404, `${o.entity} not found`);
        const problem = o.check({ ...existing, ...body });
        if (problem) throw new ApiError(400, problem);
      }
      const doc = await o.model.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
      if (!doc) throw new ApiError(404, `${o.entity} not found`);
      await audit(req, 'update', o.entity, doc._id);
      await o.onChange?.(req);
      res.json({ success: true, data: doc });
    })
  );

  r.delete(
    '/:id',
    ...(o.remove ?? o.write),
    asyncHandler(async (req, res) => {
      const doc = await o.model.findByIdAndDelete(req.params.id);
      if (!doc) throw new ApiError(404, `${o.entity} not found`);
      await audit(req, 'delete', o.entity, doc._id);
      await o.onChange?.(req);
      res.json({ success: true, data: { id: req.params.id } });
    })
  );

  return r;
}

export const zId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const zDate = z.coerce.date();
export const zBool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
