import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get all products with inventory information
 * GET /api/admin/inventory
 */
export async function getAllInventory(req, res) {
  try {
    const {
      category,
      stockStatus, // 'in-stock', 'low-stock', 'out-of-stock'
      trackInventory,
      page = 1,
      limit = 50,
      sortBy = 'stock',
      sortOrder = 'asc',
    } = req.query;

    // Build filters
    const where = {};

    if (category) {
      where.category = category.toUpperCase();
    }

    if (trackInventory !== undefined) {
      where.trackInventory = trackInventory === 'true';
    }

    // Stock status filters
    if (stockStatus === 'out-of-stock') {
      where.stock = 0;
    } else if (stockStatus === 'low-stock') {
      where.stock = {
        gt: 0,
        lte: prisma.product.fields.lowStockThreshold,
      };
    } else if (stockStatus === 'in-stock') {
      where.stock = {
        gt: prisma.product.fields.lowStockThreshold,
      };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build sort
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    // Get products with translations
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          translations: {
            where: { language: 'EN' },
          },
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Format response with stock status
    const formattedProducts = products.map(product => {
      const stockStatus =
        product.stock === 0
          ? 'out-of-stock'
          : product.stock <= product.lowStockThreshold
            ? 'low-stock'
            : 'in-stock';

      return {
        id: product.id,
        name: product.translations[0]?.name || 'Untranslated',
        category: product.category,
        price: parseFloat(product.price),
        image: product.image,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        trackInventory: product.trackInventory,
        stockStatus,
        inStock: product.inStock,
        totalOrders: product._count.orderItems,
        featured: product.featured,
        updatedAt: product.updatedAt,
      };
    });

    const totalPages = Math.ceil(total / take);

    return res.status(200).json({
      success: true,
      data: {
        products: formattedProducts,
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
    logger.error('Get inventory error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_INVENTORY_FAILED',
        message: 'Failed to fetch inventory',
      },
    });
  }
}

/**
 * Get products with low stock
 * GET /api/admin/inventory/low-stock
 */
export async function getLowStockProducts(req, res) {
  try {
    // Find products where stock is above 0 but at or below threshold
    const products = await prisma.$queryRaw`
      SELECT
        p.id,
        p.category,
        p.price,
        p.image,
        p.stock,
        p.low_stock_threshold,
        p.track_inventory,
        p.updated_at,
        pt.name
      FROM products p
      LEFT JOIN product_translations pt ON p.id = pt.product_id AND pt.language = 'EN'
      WHERE p.track_inventory = true
        AND p.stock > 0
        AND p.stock <= p.low_stock_threshold
      ORDER BY p.stock ASC
    `;

    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name || 'Untranslated',
      category: product.category,
      price: parseFloat(product.price),
      image: product.image,
      stock: product.stock,
      lowStockThreshold: product.low_stock_threshold,
      trackInventory: product.track_inventory,
      stockStatus: 'low-stock',
      updatedAt: product.updated_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        products: formattedProducts,
        count: formattedProducts.length,
      },
    });
  } catch (error) {
    logger.error('Get low stock products error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_LOW_STOCK_FAILED',
        message: 'Failed to fetch low stock products',
      },
    });
  }
}

/**
 * Update product inventory
 * PATCH /api/admin/products/:productId/inventory
 */
export async function updateProductInventory(req, res) {
  try {
    const { productId } = req.params;
    const { stock, lowStockThreshold, trackInventory, adjustmentNote } = req.body;

    // Validate product exists
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

    // Validate stock is not negative
    if (stock !== undefined && stock < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STOCK',
          message: 'Stock cannot be negative',
        },
      });
    }

    // Validate lowStockThreshold is not negative
    if (lowStockThreshold !== undefined && lowStockThreshold < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_THRESHOLD',
          message: 'Low stock threshold cannot be negative',
        },
      });
    }

    // Build update data
    const updateData = {};
    if (stock !== undefined) {
      updateData.stock = parseInt(stock);
      // Auto-update inStock based on stock quantity
      updateData.inStock = parseInt(stock) > 0;
    }
    if (lowStockThreshold !== undefined) {
      updateData.lowStockThreshold = parseInt(lowStockThreshold);
    }
    if (trackInventory !== undefined) {
      updateData.trackInventory = trackInventory;
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: {
        translations: {
          where: { language: 'EN' },
        },
      },
    });

    logger.info('Product inventory updated', {
      productId,
      stock: updateData.stock,
      adjustmentNote,
      userId: req.user.id,
    });

    // Calculate stock status
    const stockStatus =
      updatedProduct.stock === 0
        ? 'out-of-stock'
        : updatedProduct.stock <= updatedProduct.lowStockThreshold
          ? 'low-stock'
          : 'in-stock';

    return res.status(200).json({
      success: true,
      data: {
        product: {
          id: updatedProduct.id,
          name: updatedProduct.translations[0]?.name || 'Untranslated',
          stock: updatedProduct.stock,
          lowStockThreshold: updatedProduct.lowStockThreshold,
          trackInventory: updatedProduct.trackInventory,
          inStock: updatedProduct.inStock,
          stockStatus,
          updatedAt: updatedProduct.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error('Update inventory error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_INVENTORY_FAILED',
        message: 'Failed to update inventory',
      },
    });
  }
}

/**
 * Get inventory statistics
 * GET /api/admin/inventory/stats
 */
export async function getInventoryStats(req, res) {
  try {
    // Total products
    const totalProducts = await prisma.product.count();

    // Products tracking inventory
    const trackingInventory = await prisma.product.count({
      where: { trackInventory: true },
    });

    // Out of stock products
    const outOfStock = await prisma.product.count({
      where: {
        trackInventory: true,
        stock: 0,
      },
    });

    // Low stock products (using raw query for comparison)
    const lowStockResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM products
      WHERE track_inventory = true
        AND stock > 0
        AND stock <= low_stock_threshold
    `;
    const lowStock = parseInt(lowStockResult[0]?.count || 0);

    // In stock products
    const inStockResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM products
      WHERE track_inventory = true
        AND stock > low_stock_threshold
    `;
    const inStock = parseInt(inStockResult[0]?.count || 0);

    // Total stock value
    const stockValueResult = await prisma.$queryRaw`
      SELECT SUM(CAST(price AS DECIMAL) * stock) as total_value
      FROM products
      WHERE track_inventory = true
    `;
    const totalStockValue = parseFloat(stockValueResult[0]?.total_value || 0);

    // Products by category
    const productsByCategory = await prisma.product.groupBy({
      by: ['category'],
      _count: true,
      _sum: {
        stock: true,
      },
      where: {
        trackInventory: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalProducts,
        trackingInventory,
        outOfStock,
        lowStock,
        inStock,
        totalStockValue: parseFloat(totalStockValue.toFixed(2)),
        byCategory: productsByCategory.map(cat => ({
          category: cat.category,
          count: cat._count,
          totalStock: cat._sum.stock || 0,
        })),
      },
    });
  } catch (error) {
    logger.error('Get inventory stats error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_STATS_FAILED',
        message: 'Failed to fetch inventory statistics',
      },
    });
  }
}
