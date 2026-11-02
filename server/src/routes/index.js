import { Router } from 'express';
import authRoutes from './auth.js';
import memberRoutes from './members.js';
import classRoutes from './classes.js';
import opsRoutes from './ops.js';
import financeRoutes from './finance.js';
import resourceRoutes from './resources.js';
import dashboardRoutes from './dashboard.js';

const router = Router();

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/members', memberRoutes);
router.use('/classes', classRoutes);
router.use('/ops', opsRoutes);
router.use('/finance', financeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/', resourceRoutes);

export default router;
