import express from 'express';
import {
  checkout,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  updateOrderTracking,
  getOrderAnalytics
} from '../controllers/orderController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Admin order routes (require authentication and admin role)
 * IMPORTANT: These must come BEFORE the /:id route to avoid conflicts
 */

// Get analytics dashboard data (admin)
router.get('/admin/analytics', authenticate, requireAdmin, getOrderAnalytics);

// Get all orders (admin)
router.get('/admin/all', authenticate, requireAdmin, getAllOrders);

// Update order status (admin)
router.put('/admin/:id/status', authenticate, requireAdmin, updateOrderStatus);
router.patch('/admin/:id/status', authenticate, requireAdmin, updateOrderStatus);

// Update order tracking information (admin)
router.put('/admin/:id/tracking', authenticate, requireAdmin, updateOrderTracking);

/**
 * User order routes (require authentication)
 */

// Checkout - create order from cart
router.post('/checkout', authenticate, checkout);

// Get user's orders
router.get('/', authenticate, getUserOrders);

// Get single order by ID
router.get('/:id', authenticate, getOrderById);

// Cancel order (user can only cancel pending orders)
router.put('/:id/cancel', authenticate, cancelOrder);

export default router;
