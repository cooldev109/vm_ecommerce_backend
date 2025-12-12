import express from 'express';
import {
  initWebpayPayment,
  handleWebpayReturn,
  getPaymentStatus,
  getAllPayments
} from '../controllers/paymentController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * User payment routes (require authentication)
 */

// Initialize Webpay payment
router.post('/webpay/init', authenticate, initWebpayPayment);

// Webpay return URL (handles both POST and GET from Transbank)
router.post('/webpay/return', handleWebpayReturn);
router.get('/webpay/return', handleWebpayReturn);

// Get payment status for an order
router.get('/order/:orderId', authenticate, getPaymentStatus);

/**
 * Admin payment routes (require authentication and admin role)
 */

// Get all payments (admin)
router.get('/admin/all', authenticate, requireAdmin, getAllPayments);

export default router;
