import express from 'express';
import {
  getProducts,
  getProductById,
  getProductTranslations,
  createProduct,
  updateProduct,
  deleteProduct,
  upsertProductTranslation,
  updateProductAudio,
  removeProductAudio,
} from '../controllers/productController.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { createProductReview, getReviewsForProduct } from './reviews.js';

const router = express.Router();

/**
 * Public Routes
 */

/**
 * @route   GET /api/products
 * @desc    Get all products with filtering and pagination
 * @access  Public
 * @query   category, featured, inStock, language, page, limit, sortBy, sortOrder
 */
router.get('/', getProducts);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 * @query   language
 */
router.get('/:id', getProductById);

/**
 * @route   GET /api/products/:id/translations
 * @desc    Get all translations for a product
 * @access  Public
 */
router.get('/:id/translations', getProductTranslations);

/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Get all reviews for a product
 * @access  Public
 */
router.get('/:productId/reviews', getReviewsForProduct);

/**
 * @route   POST /api/products/:productId/reviews
 * @desc    Create a review for a product
 * @access  Private (Authenticated users only)
 */
router.post('/:productId/reviews', authenticate, createProductReview);

/**
 * Admin Routes (require authentication and admin role)
 */

/**
 * @route   POST /api/products
 * @desc    Create a new product
 * @access  Private (Admin only)
 */
router.post('/', authenticate, requireAdmin, createProduct);

/**
 * @route   PUT /api/products/:id
 * @desc    Update a product
 * @access  Private (Admin only)
 */
router.put('/:id', authenticate, requireAdmin, updateProduct);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete a product
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

/**
 * @route   PUT /api/products/:id/translations/:language
 * @desc    Update or create product translation
 * @access  Private (Admin only)
 */
router.put('/:id/translations/:language', authenticate, requireAdmin, upsertProductTranslation);

/**
 * @route   PUT /api/products/:id/audio
 * @desc    Update product audio information
 * @access  Private (Admin only)
 */
router.put('/:id/audio', authenticate, requireAdmin, updateProductAudio);

/**
 * @route   DELETE /api/products/:id/audio
 * @desc    Remove product audio
 * @access  Private (Admin only)
 */
router.delete('/:id/audio', authenticate, requireAdmin, removeProductAudio);

export default router;
