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
  handleSubscriptionFlowReturn,
  handleSubscriptionFlowConfirm,
  getSubscriptionPaymentStatus,
  upgradeSubscription,
  initUpgradePayment,
  handleUpgradeFlowReturn,
  handleUpgradeFlowConfirm,
  getAdminPlanConfigs,
  updatePlanConfig,
  initializePlanConfigs
} from '../controllers/subscriptionController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/plans', getSubscriptionPlans);

// Flow callbacks (no auth - called by Flow servers)
router.get('/flow/return', handleSubscriptionFlowReturn);  // User redirect
router.post('/flow/confirm', handleSubscriptionFlowConfirm);  // Server-to-server confirmation
router.get('/upgrade/flow/return', handleUpgradeFlowReturn);  // Upgrade user redirect
router.post('/upgrade/flow/confirm', handleUpgradeFlowConfirm);  // Upgrade server-to-server

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
