import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Not authenticated');
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, 'Session expired, please sign in again');
  }
  const user = await User.findById(payload.sub).select('-password');
  if (!user) throw new ApiError(401, 'User no longer exists');
  if (user.status === 'suspended') throw new ApiError(403, 'Account suspended');
  req.user = user;
  next();
});

export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Not authenticated'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'Insufficient permissions'));
  next();
};

export const notFound = (req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }
  if (status === 500) console.error('[error]', err);
  res.status(status).json({ success: false, message });
};
