import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get current user's cart with items
 * GET /api/cart
 */
export async function getCart(req, res) {
  try {
    const userId = req.user.id;

    // Find or create cart for user
    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                translations: {
                  where: {
                    language: (req.query.language || 'ES').toUpperCase()
                  }
                }
              }
            }
          }
        }
      }
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  translations: {
                    where: {
                      language: (req.query.language || 'ES').toUpperCase()
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    // Format cart items with product details
    const formattedItems = cart.items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      product: {
        id: item.product.id,
        category: item.product.category,
        price: parseFloat(item.product.price),
        name: item.product.translations[0]?.name || 'Untranslated',
        description: item.product.translations[0]?.description || '',
        imageUrl: item.product.image,
        inStock: item.product.inStock
      },
      subtotal: parseFloat(item.product.price) * item.quantity
    }));

    // Calculate cart totals
    const totalItems = formattedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = formattedItems.reduce((sum, item) => sum + item.subtotal, 0);

    res.json({
      success: true,
      data: {
        cart: {
          id: cart.id,
          userId: cart.userId,
          items: formattedItems,
          totalItems,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          updatedAt: cart.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CART_FETCH_ERROR',
        message: 'Failed to fetch cart'
      }
    });
  }
}

/**
 * Add item to cart or update quantity if already exists
 * POST /api/cart/items
 * Body: { productId, quantity }
 */
export async function addToCart(req, res) {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    // Validate input
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Product ID and valid quantity are required'
        }
      });
    }

    // Check if product exists and is in stock
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

    if (!product.inStock) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: 'Product is out of stock'
        }
      });
    }

    // Find or create cart
    let cart = await prisma.cart.findFirst({
      where: { userId }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId }
      });
    }

    // Check if item already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId
      }
    });

    let cartItem;
    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;

      // Stock validation removed - only check inStock boolean during checkout

      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
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
      logger.info('Cart item quantity updated');
    } else {
      // Get product translation for denormalized data
      const productWithTranslation = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          translations: {
            where: { language: 'ES' }
          }
        }
      });

      // Add new item to cart with denormalized data
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          name: productWithTranslation.translations[0]?.name || 'Untranslated',
          price: productWithTranslation.price,
          image: productWithTranslation.image || ''
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
      logger.info('Item added to cart');
    }

    // Update cart timestamp
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() }
    });

    res.json({
      success: true,
      data: {
        cartItem: {
          id: cartItem.id,
          quantity: cartItem.quantity,
          product: {
            id: cartItem.product.id,
            name: cartItem.product.translations[0]?.name || 'Untranslated',
            price: parseFloat(cartItem.product.price)
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error adding to cart:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CART_ADD_ERROR',
        message: 'Failed to add item to cart'
      }
    });
  }
}

/**
 * Update cart item quantity
 * PUT /api/cart/items/:itemId
 * Body: { quantity }
 */
export async function updateCartItem(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'Valid quantity is required'
        }
      });
    }

    // Find cart item and verify ownership
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: {
        cart: true,
        product: true
      }
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CART_ITEM_NOT_FOUND',
          message: 'Cart item not found'
        }
      });
    }

    // Check stock availability
    if (!cartItem.product.inStock) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: 'Product is out of stock'
        }
      });
    }

    // Update quantity
    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
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

    // Update cart timestamp
    await prisma.cart.update({
      where: { id: cartItem.cartId },
      data: { updatedAt: new Date() }
    });

    logger.info('Cart item updated');

    res.json({
      success: true,
      data: {
        cartItem: {
          id: updatedItem.id,
          quantity: updatedItem.quantity,
          product: {
            id: updatedItem.product.id,
            name: updatedItem.product.translations[0]?.name || 'Untranslated',
            price: parseFloat(updatedItem.product.price)
          }
        }
      }
    });
  } catch (error) {
    logger.error('Error updating cart item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CART_UPDATE_ERROR',
        message: 'Failed to update cart item'
      }
    });
  }
}

/**
 * Remove item from cart
 * DELETE /api/cart/items/:itemId
 */
export async function removeFromCart(req, res) {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    // Find cart item and verify ownership
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true }
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CART_ITEM_NOT_FOUND',
          message: 'Cart item not found'
        }
      });
    }

    // Delete cart item
    await prisma.cartItem.delete({
      where: { id: itemId }
    });

    // Update cart timestamp
    await prisma.cart.update({
      where: { id: cartItem.cartId },
      data: { updatedAt: new Date() }
    });

    logger.info('Item removed from cart');

    res.json({
      success: true,
      data: {
        message: 'Item removed from cart'
      }
    });
  } catch (error) {
    logger.error('Error removing from cart:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CART_REMOVE_ERROR',
        message: 'Failed to remove item from cart'
      }
    });
  }
}

/**
 * Clear all items from cart
 * DELETE /api/cart
 */
export async function clearCart(req, res) {
  try {
    const userId = req.user.id;

    // Find user's cart
    const cart = await prisma.cart.findFirst({
      where: { userId }
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CART_NOT_FOUND',
          message: 'Cart not found'
        }
      });
    }

    // Delete all cart items
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    // Update cart timestamp
    await prisma.cart.update({
      where: { id: cart.id },
      data: { updatedAt: new Date() }
    });

    logger.info('Cart cleared');

    res.json({
      success: true,
      data: {
        message: 'Cart cleared successfully'
      }
    });
  } catch (error) {
    logger.error('Error clearing cart:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CART_CLEAR_ERROR',
        message: 'Failed to clear cart'
      }
    });
  }
}
