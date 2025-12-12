import express from 'express';
import {
  getAllInventory,
  getLowStockProducts,
  updateProductInventory,
  getInventoryStats,
} from '../controllers/inventoryController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * All inventory routes require admin authentication
 */

/**
 * @route   GET /api/admin/inventory
 * @desc    Get all products with inventory information
 * @access  Private (Admin only)
 * @query   category, stockStatus, trackInventory, page, limit, sortBy, sortOrder
 */
router.get('/', authenticate, requireAdmin, getAllInventory);

/**
 * @route   GET /api/admin/inventory/low-stock
 * @desc    Get products with low stock levels
 * @access  Private (Admin only)
 */
router.get('/low-stock', authenticate, requireAdmin, getLowStockProducts);

/**
 * @route   GET /api/admin/inventory/stats
 * @desc    Get inventory statistics
 * @access  Private (Admin only)
 */
router.get('/stats', authenticate, requireAdmin, getInventoryStats);

/**
 * @route   PATCH /api/admin/products/:productId/inventory
 * @desc    Update product inventory
 * @access  Private (Admin only)
 * @body    { stock, lowStockThreshold, trackInventory, adjustmentNote }
 */
router.patch('/:productId', authenticate, requireAdmin, updateProductInventory);

export default router;
