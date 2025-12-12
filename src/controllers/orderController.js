import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Create order from cart (checkout)
 * POST /api/orders/checkout
 * Body: { shippingAddressId, billingAddressId?, notes? }
 */
export async function checkout(req, res) {
  try {
    const userId = req.user.id;
    const { shippingAddressId, billingAddressId, notes } = req.body;

    if (!shippingAddressId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESS',
          message: 'Shipping address is required'
        }
      });
    }

    // Verify addresses belong to user
    const shippingAddress = await prisma.address.findFirst({
      where: {
        id: shippingAddressId,
        profile: { userId }
      }
    });

    if (!shippingAddress) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Shipping address not found'
        }
      });
    }

    let billingAddress = shippingAddress;
    if (billingAddressId && billingAddressId !== shippingAddressId) {
      billingAddress = await prisma.address.findFirst({
        where: {
          id: billingAddressId,
          profile: { userId }
        }
      });

      if (!billingAddress) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ADDRESS_NOT_FOUND',
            message: 'Billing address not found'
          }
        });
      }
    }

    // Get user's cart with items
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_CART',
          message: 'Cart is empty'
        }
      });
    }

    // Validate stock availability and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OUT_OF_STOCK',
            message: `Product out of stock: ${product.id}`
          }
        });
      }

      const itemPrice = parseFloat(product.price);
      const itemSubtotal = itemPrice * item.quantity;
      subtotal += itemSubtotal;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        priceAtOrder: product.price
      });
    }

    // Get user profile for customer snapshot
    const userProfile = await prisma.profile.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found'
        }
      });
    }

    // Calculate shipping (simple flat rate for now)
    const shippingCost = subtotal >= 50 ? 0 : 5; // Free shipping over $50
    const total = subtotal + shippingCost;

    // Generate order ID
    const orderCount = await prisma.order.count();
    const orderId = `ORD-${String(orderCount + 1).padStart(3, '0')}`;

    // Create order in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order with customer snapshot and flattened address fields
      const newOrder = await tx.order.create({
        data: {
          id: orderId,
          userId,
          status: 'PENDING',
          customerType: userProfile.customerType,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          email: userProfile.user.email,
          phone: userProfile.phone || '',
          taxId: userProfile.taxId,
          subtotal,
          shippingCost,
          total,
          // Shipping address fields
          shippingAddress: shippingAddress.street,
          shippingCity: shippingAddress.city,
          shippingPostalCode: shippingAddress.postalCode,
          shippingCountry: shippingAddress.country,
          // Billing address fields
          billingAddress: billingAddress.street,
          billingCity: billingAddress.city,
          billingPostalCode: billingAddress.postalCode,
          billingCountry: billingAddress.country,
          items: {
            create: orderItems.map(item => {
              const cartItem = cart.items.find(ci => ci.productId === item.productId);
              return {
                productId: item.productId,
                name: cartItem.name,
                price: item.priceAtOrder,
                quantity: item.quantity,
                image: cartItem.image
              };
            })
          }
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  translations: {
                    where: { language: 'ES' }
                  }
                }
              }
            }
          }
        }
      });

      // Stock management removed - products don't track quantities, only inStock boolean

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id }
      });

      return newOrder;
    });

    logger.info(`Order created: ${order.id}`);

    // Format response
    const formattedOrder = {
      id: order.id,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      shippingAddress: {
        street: order.shippingAddress,
        city: order.shippingCity,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry
      },
      billingAddress: {
        street: order.billingAddress,
        city: order.billingCity,
        postalCode: order.billingPostalCode,
        country: order.billingCountry
      },
      items: order.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.price),
        product: {
          id: item.product.id,
          name: item.name,
          imageUrl: item.image
        },
        subtotal: parseFloat(item.price) * item.quantity
      })),
      createdAt: order.createdAt
    };

    res.status(201).json({
      success: true,
      data: { order: formattedOrder }
    });
  } catch (error) {
    logger.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHECKOUT_ERROR',
        message: 'Failed to process checkout'
      }
    });
  }
}

/**
 * Get all orders for current user
 * GET /api/orders
 */
export async function getUserOrders(req, res) {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    // Build where clause
    const where = { userId };
    if (status) {
      where.status = status.toUpperCase();
    }

    // Get orders with pagination
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                include: {
                  translations: {
                    where: { language: 'ES' }
                  }
                }
              }
            }
          },
          invoice: true
        }
      }),
      prisma.order.count({ where })
    ]);

    // Format orders
    const formattedOrders = orders.map(order => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      itemCount: order.items.length,
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      shippingStreet: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingRegion: order.shippingRegion,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.price),
        product: {
          id: item.product.id,
          name: item.name,
          images: [item.image]
        }
      })),
      invoice: order.invoice ? {
        id: order.invoice.id,
        invoiceNumber: order.invoice.invoiceNumber,
        issuedAt: order.invoice.issuedAt,
        pdfUrl: order.invoice.pdfUrl
      } : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore: parseInt(page) < totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDERS_FETCH_ERROR',
        message: 'Failed to fetch orders'
      }
    });
  }
}

/**
 * Get single order by ID
 * GET /api/orders/:id
 */
export async function getOrderById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                translations: {
                  where: { language: 'ES' }
                }
              }
            }
          }
        },
        invoice: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    // Format order
    const formattedOrder = {
      id: order.id,
      status: order.status,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      shippingAddress: {
        street: order.shippingAddress,
        city: order.shippingCity,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry
      },
      billingAddress: {
        street: order.billingAddress,
        city: order.billingCity,
        postalCode: order.billingPostalCode,
        country: order.billingCountry
      },
      items: order.items.map(item => ({
        id: item.id,
        quantity: item.quantity,
        priceAtOrder: parseFloat(item.price),
        product: {
          id: item.product.id,
          name: item.name,
          category: item.product.category,
          imageUrl: item.image
        },
        subtotal: parseFloat(item.price) * item.quantity
      })),
      invoice: order.invoice ? {
        id: order.invoice.id,
        invoiceNumber: order.invoice.invoiceNumber,
        issuedAt: order.invoice.issuedAt,
        pdfUrl: order.invoice.pdfUrl
      } : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };

    res.json({
      success: true,
      data: { order: formattedOrder }
    });
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_FETCH_ERROR',
        message: 'Failed to fetch order'
      }
    });
  }
}

/**
 * Cancel order (only if PENDING)
 * PUT /api/orders/:id/cancel
 */
export async function cancelOrder(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Find order
    const order = await prisma.order.findFirst({
      where: {
        id,
        userId
      },
      include: {
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    // Can only cancel pending orders
    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ORDER_STATUS',
          message: 'Only pending orders can be cancelled'
        }
      });
    }

    // Update order and restore stock
    await prisma.$transaction(async (tx) => {
      // Update order status
      await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      // Stock restoration removed - products don't track quantities
    });

    logger.info(`Order cancelled: ${id}`);

    res.json({
      success: true,
      data: {
        message: 'Order cancelled successfully'
      }
    });
  } catch (error) {
    logger.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_CANCEL_ERROR',
        message: 'Failed to cancel order'
      }
    });
  }
}

/**
 * Admin: Get all orders with filters
 * GET /api/admin/orders
 */
export async function getAllOrders(req, res) {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;

    // Build where clause
    const where = {};
    if (status) where.status = status.toUpperCase();
    if (userId) where.userId = userId;

    // Get orders with pagination
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true
            }
          },
          items: {
            include: {
              product: {
                include: {
                  translations: {
                    where: { language: 'ES' }
                  }
                }
              }
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    // Format orders
    const formattedOrders = orders.map(order => ({
      id: order.id,
      userId: order.userId,
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      items: order.items,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingPostalCode: order.shippingPostalCode,
      shippingCountry: order.shippingCountry,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      adminNotes: order.adminNotes,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasMore: parseInt(page) < totalPages
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching all orders:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDERS_FETCH_ERROR',
        message: 'Failed to fetch orders'
      }
    });
  }
}

/**
 * Admin: Update order status
 * PUT /api/admin/orders/:id/status
 * Body: { status }
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        }
      });
    }

    // Find order
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    // Update status (stock restoration removed)
    await prisma.order.update({
      where: { id },
      data: { status }
    });

    logger.info(`Order status updated: ${id} -> ${status}`);

    res.json({
      success: true,
      data: {
        message: 'Order status updated successfully',
        status
      }
    });
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_UPDATE_ERROR',
        message: 'Failed to update order status'
      }
    });
  }
}

/**
 * Update order tracking information
 * PUT /api/admin/orders/:id/tracking
 * Body: { trackingNumber, carrier, adminNotes }
 */
export async function updateOrderTracking(req, res) {
  try {
    const { id } = req.params;
    const { trackingNumber, carrier, adminNotes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found'
        }
      });
    }

    const updateData = {};
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (carrier !== undefined) updateData.carrier = carrier;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    // Auto-update shippedAt when tracking number is added
    if (trackingNumber && !order.shippedAt) {
      updateData.shippedAt = new Date();
      updateData.status = 'SHIPPED';
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          include: {
            profile: true
          }
        }
      }
    });

    logger.info(`Order tracking updated: ${id}`);

    res.json({
      success: true,
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    logger.error('Error updating order tracking:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORDER_TRACKING_UPDATE_ERROR',
        message: 'Failed to update order tracking'
      }
    });
  }
}

/**
 * Get admin analytics dashboard data
 * GET /api/admin/orders/analytics
 */
export async function getOrderAnalytics(req, res) {
  try {
    // Total orders
    const totalOrders = await prisma.order.count();

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true
    });

    // Orders by payment status
    const ordersByPaymentStatus = await prisma.order.groupBy({
      by: ['paymentStatus'],
      _count: true
    });

    // Total revenue (only PAID orders)
    const revenueData = await prisma.order.aggregate({
      where: {
        paymentStatus: 'PAID'
      },
      _sum: {
        total: true
      },
      _count: true
    });

    // Recent orders (last 10)
    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    // Top selling products
    const topProducts = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 5
    });

    // Fetch product details for top products
    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            translations: {
              where: { language: 'EN' }
            }
          }
        });
        return {
          productId: item.productId,
          totalSold: item._sum.quantity,
          product
        };
      })
    );

    // Orders this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const ordersThisMonth = await prisma.order.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    const revenueThisMonth = await prisma.order.aggregate({
      where: {
        createdAt: {
          gte: startOfMonth
        },
        paymentStatus: 'PAID'
      },
      _sum: {
        total: true
      }
    });

    // Format recent orders properly
    const formattedRecentOrders = recentOrders.map(order => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: parseFloat(order.total),
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      firstName: order.user?.profile?.firstName || order.firstName || 'Unknown',
      lastName: order.user?.profile?.lastName || order.lastName || '',
      email: order.user?.email || order.email,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price)
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    res.json({
      success: true,
      data: {
        totalOrders,
        ordersByStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {}),
        ordersByPaymentStatus: ordersByPaymentStatus.reduce((acc, item) => {
          acc[item.paymentStatus] = item._count;
          return acc;
        }, {}),
        totalRevenue: parseFloat(revenueData._sum.total || 0),
        paidOrdersCount: revenueData._count,
        recentOrders: formattedRecentOrders,
        topProducts: topProductsWithDetails,
        thisMonth: {
          orders: ordersThisMonth,
          revenue: parseFloat(revenueThisMonth._sum.total || 0)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching order analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_FETCH_ERROR',
        message: 'Failed to fetch analytics data'
      }
    });
  }
}
