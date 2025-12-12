import express from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} from '../controllers/cartController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * All cart routes require authentication
 */

// Get current user's cart
router.get('/', authenticate, getCart);

// Add item to cart
router.post('/items', authenticate, addToCart);

// Update cart item quantity
router.put('/items/:itemId', authenticate, updateCartItem);

// Remove item from cart
router.delete('/items/:itemId', authenticate, removeFromCart);

// Clear entire cart
router.delete('/', authenticate, clearCart);

export default router;
