import { asyncHandler, ApiError } from '../middleware/auth.js';

/**
 * Reusable REST resource factory.
 * Gives every module a consistent, paginated, searchable, auditable CRUD API.
 */
export function createCrudRouter(Model, options = {}) {
  const {
    filter = {},
    populate = [],
    searchable = [],
    sortable = 'createdAt',
    defaultSort = '-createdAt',
    create,
    update,
    beforeDelete,
    afterList,
  } = options;

  const list = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const query = { ...filter };

    if (searchable.length && req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = searchable.map((f) => ({ [f]: rx }));
    }
    for (const key of Object.keys(req.query)) {
      if (['page', 'limit', 'q', 'sort', 'fields'].includes(key)) continue;
      const value = req.query[key];
      if (value === '' || value === undefined || value === 'all') continue;
      if (['active', 'isActive', 'paid', 'featured'].includes(key)) query[key] = value === 'true';
      else if (!isNaN(Number(value)) && String(Number(value)) === String(value)) query[key] = Number(value);
      else query[key] = value;
    }

    const sort = req.query.sort ? String(req.query.sort) : defaultSort;
    const projection = req.query.fields ? String(req.query.fields).split(',').join(' ') : undefined;

    let cursor = Model.find(query)
      .sort(sort || sortable)
      .skip((page - 1) * limit)
      .limit(limit);
    if (projection) cursor = cursor.select(projection);
    if (populate.length) populate.forEach((p) => (cursor = cursor.populate(p)));

    const [items, total] = await Promise.all([cursor.lean(), Model.countDocuments(query)]);
    const payload = afterList ? await afterList(items, req) : items;
    res.json({
      success: true,
      data: payload,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    });
  });

  const getOne = asyncHandler(async (req, res) => {
    let q = Model.findById(req.params.id);
    if (populate.length) populate.forEach((p) => (q = q.populate(p)));
    const doc = await q.lean();
    if (!doc) throw new ApiError(404, `${Model.modelName} not found`);
    res.json({ success: true, data: doc });
  });

  const createOne = asyncHandler(async (req, res) => {
    const doc = create ? await create(req) : await Model.create(req.body);
    res.status(201).json({ success: true, data: doc });
  });

  const updateOne = asyncHandler(async (req, res) => {
    const doc = update ? await update(req) : await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw new ApiError(404, `${Model.modelName} not found`);
    res.json({ success: true, data: doc });
  });

  const deleteOne = asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, `${Model.modelName} not found`);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    res.json({ success: true, data: { id: req.params.id, deleted: true } });
  });

  return { list, getOne, createOne, updateOne, deleteOne };
}
