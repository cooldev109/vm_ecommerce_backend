import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get all products with filtering, pagination, and translations
 * GET /api/products
 */
export async function getProducts(req, res) {
  try {
    const {
      category,
      featured,
      inStock,
      language = 'ES',
      page = 1,
      limit = 20,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build filters
    const where = {};

    if (category) {
      where.category = category.toUpperCase();
    }

    if (featured !== undefined) {
      where.featured = featured === 'true';
    }

    if (inStock !== undefined) {
      where.inStock = inStock === 'true';
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
            where: { language: language.toUpperCase() },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Format response
    const formattedProducts = products.map(product => ({
      id: product.id,
      category: product.category,
      price: parseFloat(product.price),
      image: product.image,
      images: product.images,
      inStock: product.inStock,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      trackInventory: product.trackInventory,
      burnTime: product.burnTime,
      size: product.size,
      featured: product.featured,
      name: product.translations[0]?.name || 'Untranslated',
      description: product.translations[0]?.description || '',
      longDescription: product.translations[0]?.longDescription || '',
      features: product.translations[0]?.features || [],
    }));

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
    logger.error('Get products error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PRODUCTS_FAILED',
        message: 'Failed to fetch products',
      },
    });
  }
}

/**
 * Get single product by ID with all translations
 * GET /api/products/:id
 */
export async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const { language = 'ES' } = req.query;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        translations: {
          where: { language: language.toUpperCase() },
        },
      },
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

    const formattedProduct = {
      id: product.id,
      category: product.category,
      price: parseFloat(product.price),
      image: product.image,
      images: product.images,
      inStock: product.inStock,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      trackInventory: product.trackInventory,
      burnTime: product.burnTime,
      size: product.size,
      featured: product.featured,
      name: product.translations[0]?.name || 'Untranslated',
      description: product.translations[0]?.description || '',
      longDescription: product.translations[0]?.longDescription || '',
      features: product.translations[0]?.features || [],
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    return res.status(200).json({
      success: true,
      data: { product: formattedProduct },
    });
  } catch (error) {
    logger.error('Get product error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PRODUCT_FAILED',
        message: 'Failed to fetch product',
      },
    });
  }
}

/**
 * Get all translations for a product
 * GET /api/products/:id/translations
 */
export async function getProductTranslations(req, res) {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
      },
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

    return res.status(200).json({
      success: true,
      data: {
        productId: product.id,
        translations: product.translations,
      },
    });
  } catch (error) {
    logger.error('Get product translations error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_TRANSLATIONS_FAILED',
        message: 'Failed to fetch translations',
      },
    });
  }
}

/**
 * Create a new product (Admin only)
 * POST /api/admin/products
 */
export async function createProduct(req, res) {
  try {
    const {
      id,
      category,
      price,
      image,
      images = [],
      inStock = true,
      stock = 0,
      lowStockThreshold = 10,
      trackInventory = true,
      burnTime,
      size,
      featured = false,
      sortOrder = 0,
      translations,
    } = req.body;

    // Create product with translations
    const product = await prisma.product.create({
      data: {
        id,
        category,
        price,
        image,
        images,
        inStock,
        stock,
        lowStockThreshold,
        trackInventory,
        burnTime,
        size,
        featured,
        sortOrder,
        translations: {
          create: translations || [],
        },
      },
      include: {
        translations: true,
      },
    });

    logger.info('Product created', { productId: product.id, userId: req.user.id });

    return res.status(201).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    logger.error('Create product error:', error);

    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PRODUCT_EXISTS',
          message: 'A product with this ID already exists',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_PRODUCT_FAILED',
        message: 'Failed to create product',
      },
    });
  }
}

/**
 * Update a product (Admin only)
 * PUT /api/admin/products/:id
 */
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      category,
      price,
      image,
      images,
      inStock,
      stock,
      lowStockThreshold,
      trackInventory,
      burnTime,
      size,
      featured,
      sortOrder,
    } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        category,
        price,
        image,
        images,
        inStock,
        stock,
        lowStockThreshold,
        trackInventory,
        burnTime,
        size,
        featured,
        sortOrder,
      },
      include: {
        translations: true,
      },
    });

    logger.info('Product updated', { productId: id, userId: req.user.id });

    return res.status(200).json({
      success: true,
      data: { product },
    });
  } catch (error) {
    logger.error('Update product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PRODUCT_FAILED',
        message: 'Failed to update product',
      },
    });
  }
}

/**
 * Delete a product (Admin only)
 * DELETE /api/admin/products/:id
 */
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id },
    });

    logger.info('Product deleted', { productId: id, userId: req.user.id });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Product deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Delete product error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_PRODUCT_FAILED',
        message: 'Failed to delete product',
      },
    });
  }
}

/**
 * Update or create product translation (Admin only)
 * PUT /api/admin/products/:id/translations/:language
 */
export async function upsertProductTranslation(req, res) {
  try {
    const { id, language } = req.params;
    const { name, description, longDescription, features = [] } = req.body;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
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

    // Upsert translation
    const translation = await prisma.productTranslation.upsert({
      where: {
        productId_language: {
          productId: id,
          language: language.toUpperCase(),
        },
      },
      update: {
        name,
        description,
        longDescription,
        features,
      },
      create: {
        productId: id,
        language: language.toUpperCase(),
        name,
        description,
        longDescription,
        features,
      },
    });

    logger.info('Product translation updated', {
      productId: id,
      language,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: { translation },
    });
  } catch (error) {
    logger.error('Upsert translation error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_TRANSLATION_FAILED',
        message: 'Failed to update translation',
      },
    });
  }
}

/**
 * Update product audio information
 * PUT /api/admin/products/:id/audio
 */
export async function updateProductAudio(req, res) {
  try {
    const { id } = req.params;
    const { audioUrl, audioTitle, audioDuration } = req.body;

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id },
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

    // Validate audio data
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AUDIO_DATA',
          message: 'Audio URL is required',
        },
      });
    }

    // Update product with audio information
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        audioUrl,
        audioTitle: audioTitle || null,
        audioDuration: audioDuration ? parseInt(audioDuration) : null,
      },
      include: {
        translations: true,
      },
    });

    logger.info('Product audio updated', {
      productId: id,
      audioUrl,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: { product: updatedProduct },
    });
  } catch (error) {
    logger.error('Update audio error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_AUDIO_FAILED',
        message: 'Failed to update product audio',
      },
    });
  }
}

/**
 * Remove product audio
 * DELETE /api/admin/products/:id/audio
 */
export async function removeProductAudio(req, res) {
  try {
    const { id } = req.params;

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id },
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

    // Remove audio information
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        audioUrl: null,
        audioTitle: null,
        audioDuration: null,
      },
      include: {
        translations: true,
      },
    });

    logger.info('Product audio removed', {
      productId: id,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      data: { product: updatedProduct },
    });
  } catch (error) {
    logger.error('Remove audio error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REMOVE_AUDIO_FAILED',
        message: 'Failed to remove product audio',
      },
    });
  }
}
