import express from 'express';
import {
  getProfile,
  updateProfile,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../controllers/profileController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest, updateProfileSchema, addressSchema } from '../utils/validation.js';

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/', getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/', validateRequest(updateProfileSchema), updateProfile);

/**
 * @route   GET /api/profile/addresses
 * @desc    Get all user addresses
 * @access  Private
 */
router.get('/addresses', getAddresses);

/**
 * @route   POST /api/profile/addresses
 * @desc    Create a new address
 * @access  Private
 */
router.post('/addresses', validateRequest(addressSchema), createAddress);

/**
 * @route   PUT /api/profile/addresses/:id
 * @desc    Update an address
 * @access  Private
 */
router.put('/addresses/:id', validateRequest(addressSchema), updateAddress);

/**
 * @route   DELETE /api/profile/addresses/:id
 * @desc    Delete an address
 * @access  Private
 */
router.delete('/addresses/:id', deleteAddress);

export default router;
