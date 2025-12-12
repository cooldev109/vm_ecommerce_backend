import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get all audio content with filtering
 * GET /api/audio
 * Query params: category, isPreview, page, limit
 */
export async function getAudioContent(req, res) {
  try {
    const {
      category,
      isPreview,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};

    if (category) {
      where.category = category.toUpperCase();
    }

    if (isPreview !== undefined) {
      where.isPreview = isPreview === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [audioContent, total] = await Promise.all([
      prisma.audioContent.findMany({
        where,
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.audioContent.count({ where }),
    ]);

    const totalPages = Math.ceil(total / take);

    return res.status(200).json({
      success: true,
      data: {
        audioContent,
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
    logger.error('Get audio content error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_AUDIO_FAILED',
        message: 'Failed to fetch audio content',
      },
    });
  }
}

/**
 * Get single audio content by ID
 * GET /api/audio/:id
 */
export async function getAudioById(req, res) {
  try {
    const { id } = req.params;

    const audio = await prisma.audioContent.findUnique({
      where: { id },
    });

    if (!audio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIO_NOT_FOUND',
          message: 'Audio content not found',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: { audio },
    });
  } catch (error) {
    logger.error('Get audio by ID error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_AUDIO_FAILED',
        message: 'Failed to fetch audio content',
      },
    });
  }
}

/**
 * Get audio content accessible to user based on subscription
 * GET /api/audio/my-library
 * Requires authentication
 */
export async function getMyAudioLibrary(req, res) {
  try {
    const userId = req.user.id;

    // Check user's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // Check for redeemed access keys
    const accessKey = await prisma.audioAccessKey.findFirst({
      where: {
        redeemedByUserId: userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const hasAccess = !!subscription || !!accessKey;
    const planId = subscription?.planId || accessKey?.planId || null;

    // Get all audio content
    const audioContent = await prisma.audioContent.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // Filter based on access
    const library = audioContent.map(audio => {
      const canAccess = audio.isPreview || hasAccess && (
        !audio.requiredPlan ||
        audio.requiredPlan === planId ||
        (planId === 'ANNUAL') || // Annual has access to all
        (planId === 'QUARTERLY' && audio.requiredPlan !== 'ANNUAL') // Quarterly has access to monthly content
      );

      return {
        ...audio,
        canAccess,
        fileUrl: canAccess ? audio.fileUrl : null, // Hide URL if no access
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        hasSubscription: !!subscription,
        hasAccessKey: !!accessKey,
        planId,
        expiresAt: subscription?.expiresAt || accessKey?.expiresAt || null,
        library,
      },
    });
  } catch (error) {
    logger.error('Get my audio library error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_LIBRARY_FAILED',
        message: 'Failed to fetch audio library',
      },
    });
  }
}

/**
 * Stream audio content (with access check)
 * GET /api/audio/:id/stream
 * Requires authentication for non-preview content
 */
export async function streamAudio(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const audio = await prisma.audioContent.findUnique({
      where: { id },
    });

    if (!audio) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIO_NOT_FOUND',
          message: 'Audio content not found',
        },
      });
    }

    // Preview content is accessible to everyone
    if (audio.isPreview) {
      return res.status(200).json({
        success: true,
        data: {
          streamUrl: audio.fileUrl,
          audio,
        },
      });
    }

    // Non-preview content requires authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required to access this content',
        },
      });
    }

    // Check subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    // Check access key
    const accessKey = await prisma.audioAccessKey.findFirst({
      where: {
        redeemedByUserId: userId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const hasAccess = !!subscription || !!accessKey;
    const planId = subscription?.planId || accessKey?.planId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'An active subscription is required to access this content',
        },
      });
    }

    // Check plan-specific access
    if (audio.requiredPlan) {
      const hasRequiredPlan =
        planId === audio.requiredPlan ||
        planId === 'ANNUAL' ||
        (planId === 'QUARTERLY' && audio.requiredPlan === 'MONTHLY');

      if (!hasRequiredPlan) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'PLAN_UPGRADE_REQUIRED',
            message: `This content requires a ${audio.requiredPlan} plan or higher`,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        streamUrl: audio.fileUrl,
        audio,
      },
    });
  } catch (error) {
    logger.error('Stream audio error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'STREAM_FAILED',
        message: 'Failed to stream audio content',
      },
    });
  }
}

/**
 * Redeem an access key
 * POST /api/audio/redeem-key
 * Body: { keyCode: string }
 */
export async function redeemAccessKey(req, res) {
  try {
    const userId = req.user.id;
    const { keyCode } = req.body;

    if (!keyCode) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'KEY_REQUIRED',
          message: 'Access key code is required',
        },
      });
    }

    // Find the access key
    const accessKey = await prisma.audioAccessKey.findUnique({
      where: { keyCode: keyCode.toUpperCase().trim() },
    });

    if (!accessKey) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'Invalid access key',
        },
      });
    }

    if (accessKey.isRedeemed) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'KEY_ALREADY_REDEEMED',
          message: 'This access key has already been redeemed',
        },
      });
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + accessKey.durationMonths);

    // Redeem the key
    const redeemedKey = await prisma.audioAccessKey.update({
      where: { id: accessKey.id },
      data: {
        isRedeemed: true,
        redeemedAt: new Date(),
        redeemedByUserId: userId,
        expiresAt,
      },
    });

    logger.info(`Access key redeemed: ${keyCode} by user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        message: 'Access key redeemed successfully',
        planId: redeemedKey.planId,
        expiresAt: redeemedKey.expiresAt,
        durationMonths: redeemedKey.durationMonths,
      },
    });
  } catch (error) {
    logger.error('Redeem access key error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REDEEM_FAILED',
        message: 'Failed to redeem access key',
      },
    });
  }
}

// ============ ADMIN ENDPOINTS ============

/**
 * Create audio content (Admin only)
 * POST /api/audio/admin
 */
export async function createAudioContent(req, res) {
  try {
    const { titleKey, category, fileUrl, durationSeconds, isPreview, requiredPlan, sortOrder } = req.body;

    if (!titleKey || !category || !fileUrl || !durationSeconds) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'titleKey, category, fileUrl, and durationSeconds are required',
        },
      });
    }

    const audio = await prisma.audioContent.create({
      data: {
        titleKey,
        category: category.toUpperCase(),
        fileUrl,
        durationSeconds: parseInt(durationSeconds),
        isPreview: isPreview || false,
        requiredPlan: requiredPlan || null,
        sortOrder: sortOrder || 0,
      },
    });

    logger.info(`Audio content created: ${audio.id}`);

    return res.status(201).json({
      success: true,
      data: { audio },
    });
  } catch (error) {
    logger.error('Create audio content error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_AUDIO_FAILED',
        message: 'Failed to create audio content',
      },
    });
  }
}

/**
 * Update audio content (Admin only)
 * PUT /api/audio/admin/:id
 */
export async function updateAudioContent(req, res) {
  try {
    const { id } = req.params;
    const { titleKey, category, fileUrl, durationSeconds, isPreview, requiredPlan, sortOrder } = req.body;

    const existing = await prisma.audioContent.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIO_NOT_FOUND',
          message: 'Audio content not found',
        },
      });
    }

    const audio = await prisma.audioContent.update({
      where: { id },
      data: {
        ...(titleKey && { titleKey }),
        ...(category && { category: category.toUpperCase() }),
        ...(fileUrl && { fileUrl }),
        ...(durationSeconds && { durationSeconds: parseInt(durationSeconds) }),
        ...(isPreview !== undefined && { isPreview }),
        ...(requiredPlan !== undefined && { requiredPlan }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });

    logger.info(`Audio content updated: ${audio.id}`);

    return res.status(200).json({
      success: true,
      data: { audio },
    });
  } catch (error) {
    logger.error('Update audio content error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_AUDIO_FAILED',
        message: 'Failed to update audio content',
      },
    });
  }
}

/**
 * Delete audio content (Admin only)
 * DELETE /api/audio/admin/:id
 */
export async function deleteAudioContent(req, res) {
  try {
    const { id } = req.params;

    const existing = await prisma.audioContent.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'AUDIO_NOT_FOUND',
          message: 'Audio content not found',
        },
      });
    }

    await prisma.audioContent.delete({
      where: { id },
    });

    logger.info(`Audio content deleted: ${id}`);

    return res.status(200).json({
      success: true,
      data: { message: 'Audio content deleted successfully' },
    });
  } catch (error) {
    logger.error('Delete audio content error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_AUDIO_FAILED',
        message: 'Failed to delete audio content',
      },
    });
  }
}

/**
 * Generate access keys (Admin only)
 * POST /api/audio/admin/generate-keys
 * Body: { planId, durationMonths, count }
 */
export async function generateAccessKeys(req, res) {
  try {
    const { planId, durationMonths, count = 1 } = req.body;

    if (!planId || !durationMonths) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'planId and durationMonths are required',
        },
      });
    }

    const keys = [];
    for (let i = 0; i < Math.min(count, 100); i++) {
      // Generate key in format VM-XXXXX-XXXXX
      const randomPart = () => Math.random().toString(36).substring(2, 7).toUpperCase();
      const keyCode = `VM-${randomPart()}-${randomPart()}`;

      const key = await prisma.audioAccessKey.create({
        data: {
          keyCode,
          planId,
          durationMonths: parseInt(durationMonths),
        },
      });
      keys.push(key);
    }

    logger.info(`Generated ${keys.length} access keys for plan ${planId}`);

    return res.status(201).json({
      success: true,
      data: { keys },
    });
  } catch (error) {
    logger.error('Generate access keys error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'GENERATE_KEYS_FAILED',
        message: 'Failed to generate access keys',
      },
    });
  }
}

/**
 * Get all access keys (Admin only)
 * GET /api/audio/admin/keys
 */
export async function getAllAccessKeys(req, res) {
  try {
    const { page = 1, limit = 50, redeemed } = req.query;

    const where = {};
    if (redeemed !== undefined) {
      where.isRedeemed = redeemed === 'true';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [keys, total] = await Promise.all([
      prisma.audioAccessKey.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          redeemedBy: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      prisma.audioAccessKey.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        keys,
        pagination: {
          page: parseInt(page),
          limit: take,
          total,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (error) {
    logger.error('Get all access keys error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_KEYS_FAILED',
        message: 'Failed to fetch access keys',
      },
    });
  }
}
