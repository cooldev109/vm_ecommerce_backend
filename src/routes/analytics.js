import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

/**
 * GET /api/admin/analytics
 * Get comprehensive analytics data
 * Requires: Admin authentication
 */
router.get('/', authenticate, requireAdmin, getAnalytics);

export default router;
