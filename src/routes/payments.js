import express from 'express';
import {
  initFlowPayment,
  handleFlowReturn,
  handleFlowConfirm,
  getPaymentStatus,
  getAllPayments
} from '../controllers/paymentController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * User payment routes (require authentication)
 */

// Initialize Flow payment
router.post('/flow/init', authenticate, initFlowPayment);

// Flow callbacks (no auth - called by Flow servers)
router.get('/flow/return', handleFlowReturn);  // User redirect
router.post('/flow/confirm', handleFlowConfirm);  // Server-to-server confirmation

// Get payment status for an order
router.get('/order/:orderId', authenticate, getPaymentStatus);

/**
 * Admin payment routes (require authentication and admin role)
 */

// Get all payments (admin)
router.get('/admin/all', authenticate, requireAdmin, getAllPayments);

export default router;
