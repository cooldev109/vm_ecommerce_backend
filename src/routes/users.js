import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  getUserStats,
  createUser,
  updateUser,
  deleteUser,
  getAllCustomers,
  getCustomerDetails,
  getCustomerStats
} from '../controllers/userController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

/**
 * Admin user management routes (require authentication and admin role)
 */

// Get user statistics
router.get('/admin/stats', authenticate, requireAdmin, getUserStats);

// Get all users with pagination
router.get('/admin/all', authenticate, requireAdmin, getAllUsers);

/**
 * Customer management routes (require authentication and admin role)
 */

// Get customer statistics
router.get('/admin/customers/stats', authenticate, requireAdmin, getCustomerStats);

// Get all customers with order data
router.get('/admin/customers', authenticate, requireAdmin, getAllCustomers);

// Get customer details with full order history
router.get('/admin/customers/:userId', authenticate, requireAdmin, getCustomerDetails);

// Get user by ID
router.get('/admin/:id', authenticate, requireAdmin, getUserById);

// Create new user
router.post('/admin/create', authenticate, requireAdmin, createUser);

// Update user profile
router.put('/admin/:id', authenticate, requireAdmin, updateUser);

// Update user role
router.put('/admin/:id/role', authenticate, requireAdmin, updateUserRole);

// Delete user
router.delete('/admin/:id', authenticate, requireAdmin, deleteUser);

export default router;
