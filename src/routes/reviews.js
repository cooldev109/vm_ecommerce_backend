import express from 'express';
import {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * User review routes
 */

/**
 * @route   GET /api/reviews/my-reviews
 * @desc    Get current user's reviews
 * @access  Private
 */
router.get('/my-reviews', authenticate, getUserReviews);

/**
 * @route   PUT /api/reviews/:id
 * @desc    Update a review
 * @access  Private (Owner only)
 */
router.put('/:id', authenticate, updateReview);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @access  Private (Owner or Admin)
 */
router.delete('/:id', authenticate, deleteReview);

/**
 * Product-specific review routes
 * These are nested under /api/products/:productId/reviews
 */

/**
 * @route   POST /api/products/:productId/reviews
 * @desc    Create a review for a product
 * @access  Private (Authenticated users only)
 */
export const createProductReview = createReview;

/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Get all reviews for a product
 * @access  Public
 */
export const getReviewsForProduct = getProductReviews;

export default router;
