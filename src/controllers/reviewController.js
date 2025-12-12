import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Create a review for a product
 * POST /api/products/:productId/reviews
 */
export async function createReview(req, res) {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RATING',
          message: 'Rating must be between 1 and 5',
        },
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.productReview.findUnique({
      where: {
        productId_userId: {
          productId,
          userId,
        },
      },
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REVIEW_EXISTS',
          message: 'You have already reviewed this product',
        },
      });
    }

    // Check if user has purchased this product (verified buyer)
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          paymentStatus: 'PAID',
        },
      },
    });

    // Create review
    const review = await prisma.productReview.create({
      data: {
        productId,
        userId,
        rating: parseInt(rating),
        comment: comment || null,
        verified: !!hasPurchased,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Format response
    const formattedReview = {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      verified: review.verified,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: review.user.id,
        name: review.user.profile
          ? `${review.user.profile.firstName} ${review.user.profile.lastName}`
          : review.user.email.split('@')[0],
      },
    };

    logger.info('Review created', { reviewId: review.id, productId, userId });

    return res.status(201).json({
      success: true,
      data: { review: formattedReview },
    });
  } catch (error) {
    logger.error('Create review error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_REVIEW_FAILED',
        message: 'Failed to create review',
      },
    });
  }
}

/**
 * Get all reviews for a product
 * GET /api/products/:productId/reviews
 */
export async function getProductReviews(req, res) {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get reviews with user info
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      }),
      prisma.productReview.count({ where: { productId } }),
    ]);

    // Calculate average rating
    const ratingStats = await prisma.productReview.aggregate({
      where: { productId },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    // Format reviews
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      verified: review.verified,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: review.user.id,
        name: review.user.profile
          ? `${review.user.profile.firstName} ${review.user.profile.lastName}`
          : review.user.email.split('@')[0],
      },
    }));

    const totalPages = Math.ceil(total / take);

    return res.status(200).json({
      success: true,
      data: {
        reviews: formattedReviews,
        stats: {
          averageRating: ratingStats._avg.rating || 0,
          totalReviews: ratingStats._count.rating || 0,
        },
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages,
          hasMore: parseInt(page) < totalPages,
        },
      },
    });
  } catch (error) {
    logger.error('Get product reviews error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_REVIEWS_FAILED',
        message: 'Failed to fetch reviews',
      },
    });
  }
}

/**
 * Get current user's reviews
 * GET /api/reviews/my-reviews
 */
export async function getUserReviews(req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Get user's reviews with product info
    const [reviews, total] = await Promise.all([
      prisma.productReview.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              translations: {
                where: { language: 'ES' }, // Default to Spanish
                take: 1,
              },
            },
          },
        },
      }),
      prisma.productReview.count({ where: { userId } }),
    ]);

    // Format reviews
    const formattedReviews = reviews.map((review) => ({
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      verified: review.verified,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      product: {
        id: review.product.id,
        name: review.product.translations[0]?.name || 'Untranslated',
        image: review.product.image,
        price: parseFloat(review.product.price),
      },
    }));

    const totalPages = Math.ceil(total / take);

    return res.status(200).json({
      success: true,
      data: {
        reviews: formattedReviews,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages,
          hasMore: parseInt(page) < totalPages,
        },
      },
    });
  } catch (error) {
    logger.error('Get user reviews error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USER_REVIEWS_FAILED',
        message: 'Failed to fetch your reviews',
      },
    });
  }
}

/**
 * Update a review
 * PUT /api/reviews/:id
 */
export async function updateReview(req, res) {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_RATING',
          message: 'Rating must be between 1 and 5',
        },
      });
    }

    // Check if review exists and belongs to user
    const existingReview = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found',
        },
      });
    }

    if (existingReview.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only edit your own reviews',
        },
      });
    }

    // Update review
    const review = await prisma.productReview.update({
      where: { id },
      data: {
        ...(rating && { rating: parseInt(rating) }),
        ...(comment !== undefined && { comment: comment || null }),
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    // Format response
    const formattedReview = {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      verified: review.verified,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: review.user.id,
        name: review.user.profile
          ? `${review.user.profile.firstName} ${review.user.profile.lastName}`
          : review.user.email.split('@')[0],
      },
    };

    logger.info('Review updated', { reviewId: id, userId });

    return res.status(200).json({
      success: true,
      data: { review: formattedReview },
    });
  } catch (error) {
    logger.error('Update review error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_REVIEW_FAILED',
        message: 'Failed to update review',
      },
    });
  }
}

/**
 * Delete a review
 * DELETE /api/reviews/:id
 */
export async function deleteReview(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if review exists and belongs to user
    const existingReview = await prisma.productReview.findUnique({
      where: { id },
    });

    if (!existingReview) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found',
        },
      });
    }

    if (existingReview.userId !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own reviews',
        },
      });
    }

    // Delete review
    await prisma.productReview.delete({
      where: { id },
    });

    logger.info('Review deleted', { reviewId: id, userId });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Review deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Delete review error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_REVIEW_FAILED',
        message: 'Failed to delete review',
      },
    });
  }
}
