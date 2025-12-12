import express from 'express';
import {
  getSubscriptionPlans,
  getUserSubscription,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getAllSubscriptions,
  getSubscriptionAnalytics,
  initSubscriptionPayment,
  handleSubscriptionWebpayReturn,
  getSubscriptionPaymentStatus
} from '../controllers/subscriptionController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', getSubscriptionPlans);

// Webpay return callback (no auth - called by Transbank)
router.post('/webpay/return', handleSubscriptionWebpayReturn);
router.get('/webpay/return', handleSubscriptionWebpayReturn); // Some browsers may use GET

// User routes (authenticated)
router.get('/my-subscription', authenticate, getUserSubscription);
router.post('/', authenticate, createSubscription);
router.post('/payment/init', authenticate, initSubscriptionPayment);
router.get('/payment/status/:subscriptionId', authenticate, getSubscriptionPaymentStatus);
router.put('/:subscriptionId', authenticate, updateSubscription);
router.post('/:subscriptionId/cancel', authenticate, cancelSubscription);
router.post('/:subscriptionId/pause', authenticate, pauseSubscription);
router.post('/:subscriptionId/resume', authenticate, resumeSubscription);

// Admin routes
router.get('/admin/all', authenticate, requireAdmin, getAllSubscriptions);
router.get('/admin/analytics', authenticate, requireAdmin, getSubscriptionAnalytics);

export default router;
