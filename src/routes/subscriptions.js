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
  getSubscriptionPaymentStatus,
  upgradeSubscription,
  initUpgradePayment,
  handleUpgradeWebpayReturn,
  getAdminPlanConfigs,
  updatePlanConfig,
  initializePlanConfigs
} from '../controllers/subscriptionController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', getSubscriptionPlans);

// Webpay return callbacks (no auth - called by Transbank)
router.post('/webpay/return', handleSubscriptionWebpayReturn);
router.get('/webpay/return', handleSubscriptionWebpayReturn); // Some browsers may use GET
router.post('/upgrade/webpay/return', handleUpgradeWebpayReturn);
router.get('/upgrade/webpay/return', handleUpgradeWebpayReturn); // Some browsers may use GET

// User routes (authenticated)
router.get('/my-subscription', authenticate, getUserSubscription);
router.post('/', authenticate, createSubscription);
router.post('/payment/init', authenticate, initSubscriptionPayment);
router.get('/payment/status/:subscriptionId', authenticate, getSubscriptionPaymentStatus);
router.put('/:subscriptionId', authenticate, updateSubscription);
router.post('/:subscriptionId/cancel', authenticate, cancelSubscription);
router.post('/:subscriptionId/pause', authenticate, pauseSubscription);
router.post('/:subscriptionId/resume', authenticate, resumeSubscription);

// Upgrade routes (authenticated)
router.post('/:subscriptionId/upgrade', authenticate, upgradeSubscription);
router.post('/upgrade/payment/init', authenticate, initUpgradePayment);

// Admin routes
router.get('/admin/all', authenticate, requireAdmin, getAllSubscriptions);
router.get('/admin/analytics', authenticate, requireAdmin, getSubscriptionAnalytics);

// Admin plan management routes
router.get('/admin/plans', authenticate, requireAdmin, getAdminPlanConfigs);
router.put('/admin/plans/:planId', authenticate, requireAdmin, updatePlanConfig);
router.post('/admin/plans/initialize', authenticate, requireAdmin, initializePlanConfigs);

export default router;
