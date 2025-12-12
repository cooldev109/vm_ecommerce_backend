import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus
} from '../controllers/wishlistController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * All wishlist routes require authentication
 */

// Get current user's wishlist
router.get('/', authenticate, getWishlist);

// Check if product is in wishlist
router.get('/check/:productId', authenticate, checkWishlistStatus);

// Add product to wishlist
router.post('/:productId', authenticate, addToWishlist);

// Remove product from wishlist
router.delete('/:productId', authenticate, removeFromWishlist);

export default router;
