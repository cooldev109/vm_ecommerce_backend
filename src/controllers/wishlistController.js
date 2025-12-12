import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get current user's wishlist with product details
 * GET /api/wishlist
 */
export async function getWishlist(req, res) {
  try {
    const userId = req.user.id;
    const language = (req.query.language || 'ES').toUpperCase();

    // Get all wishlist items for the user
    const wishlistItems = await prisma.wishlistItem.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            translations: {
              where: { language }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format wishlist items with product details
    const formattedItems = wishlistItems.map(item => ({
      id: item.id,
      productId: item.productId,
      product: {
        id: item.product.id,
        category: item.product.category,
        price: parseFloat(item.product.price),
        name: item.product.translations[0]?.name || 'Untranslated',
        description: item.product.translations[0]?.description || '',
        imageUrl: item.product.image,
        inStock: item.product.inStock
      },
      addedAt: item.createdAt
    }));

    res.json({
      success: true,
      data: {
        items: formattedItems,
        count: formattedItems.length
      }
    });
  } catch (error) {
    logger.error('Error fetching wishlist:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WISHLIST_FETCH_ERROR',
        message: 'Failed to fetch wishlist'
      }
    });
  }
}

/**
 * Add product to wishlist
 * POST /api/wishlist/:productId
 */
export async function addToWishlist(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found'
        }
      });
    }

    // Check if already in wishlist
    const existingItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (existingItem) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_IN_WISHLIST',
          message: 'Product is already in wishlist'
        }
      });
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlistItem.create({
      data: {
        userId,
        productId
      },
      include: {
        product: {
          include: {
            translations: {
              where: { language: 'ES' }
            }
          }
        }
      }
    });

    logger.info('Product added to wishlist', { userId, productId });

    res.json({
      success: true,
      data: {
        item: {
          id: wishlistItem.id,
          productId: wishlistItem.productId,
          product: {
            id: wishlistItem.product.id,
            name: wishlistItem.product.translations[0]?.name || 'Untranslated',
            price: parseFloat(wishlistItem.product.price)
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error adding to wishlist:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WISHLIST_ADD_ERROR',
        message: 'Failed to add product to wishlist'
      }
    });
  }
}

/**
 * Remove product from wishlist
 * DELETE /api/wishlist/:productId
 */
export async function removeFromWishlist(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Find and delete wishlist item
    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WISHLIST_ITEM_NOT_FOUND',
          message: 'Product not found in wishlist'
        }
      });
    }

    await prisma.wishlistItem.delete({
      where: {
        id: wishlistItem.id
      }
    });

    logger.info('Product removed from wishlist', { userId, productId });

    res.json({
      success: true,
      data: {
        message: 'Product removed from wishlist'
      }
    });
  } catch (error) {
    logger.error('Error removing from wishlist:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WISHLIST_REMOVE_ERROR',
        message: 'Failed to remove product from wishlist'
      }
    });
  }
}

/**
 * Check if product is in user's wishlist
 * GET /api/wishlist/check/:productId
 */
export async function checkWishlistStatus(req, res) {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const wishlistItem = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    res.json({
      success: true,
      data: {
        inWishlist: !!wishlistItem
      }
    });
  } catch (error) {
    logger.error('Error checking wishlist status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WISHLIST_CHECK_ERROR',
        message: 'Failed to check wishlist status'
      }
    });
  }
}
