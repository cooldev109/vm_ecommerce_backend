import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get user profile
 * GET /api/profile
 */
export async function getProfile(req, res) {
  try {
    // Get user with profile
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: {
          include: {
            addresses: {
              orderBy: { isDefault: 'desc' },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    if (!user.profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile,
        },
        profile: user.profile,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_PROFILE_FAILED',
        message: 'Failed to fetch profile',
      },
    });
  }
}

/**
 * Update user profile
 * PUT /api/profile
 */
export async function updateProfile(req, res) {
  try {
    const { firstName, lastName, phone, customerType, taxId, preferredLanguage } = req.body;

    const updatedProfile = await prisma.profile.update({
      where: { userId: req.user.id },
      data: {
        firstName,
        lastName,
        phone,
        customerType,
        taxId,
        preferredLanguage,
      },
    });

    logger.info('Profile updated', { userId: req.user.id });

    return res.status(200).json({
      success: true,
      data: { profile: updatedProfile },
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_PROFILE_FAILED',
        message: 'Failed to update profile',
      },
    });
  }
}

/**
 * Get all addresses for user
 * GET /api/profile/addresses
 */
export async function getAddresses(req, res) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
        },
      });
    }

    const addresses = await prisma.address.findMany({
      where: { profileId: profile.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return res.status(200).json({
      success: true,
      data: { addresses },
    });
  } catch (error) {
    logger.error('Get addresses error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_ADDRESSES_FAILED',
        message: 'Failed to fetch addresses',
      },
    });
  }
}

/**
 * Create a new address
 * POST /api/profile/addresses
 */
export async function createAddress(req, res) {
  try {
    const { type, street, city, region, postalCode, country, isDefault } = req.body;

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
        },
      });
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          profileId: profile.id,
          type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const address = await prisma.address.create({
      data: {
        profileId: profile.id,
        type,
        street,
        city,
        region,
        postalCode,
        country,
        isDefault,
      },
    });

    logger.info('Address created', { userId: req.user.id, addressId: address.id });

    return res.status(201).json({
      success: true,
      data: { address },
    });
  } catch (error) {
    logger.error('Create address error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CREATE_ADDRESS_FAILED',
        message: 'Failed to create address',
      },
    });
  }
}

/**
 * Update an address
 * PUT /api/profile/addresses/:id
 */
export async function updateAddress(req, res) {
  try {
    const { id } = req.params;
    const { type, street, city, region, postalCode, country, isDefault } = req.body;

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
        },
      });
    }

    // Verify address belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id },
    });

    if (!existingAddress || existingAddress.profileId !== profile.id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Address not found',
        },
      });
    }

    // If this is set as default, unset other defaults of the same type
    if (isDefault) {
      await prisma.address.updateMany({
        where: {
          profileId: profile.id,
          type,
          isDefault: true,
          id: { not: id },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { id },
      data: {
        type,
        street,
        city,
        region,
        postalCode,
        country,
        isDefault,
      },
    });

    logger.info('Address updated', { userId: req.user.id, addressId: id });

    return res.status(200).json({
      success: true,
      data: { address: updatedAddress },
    });
  } catch (error) {
    logger.error('Update address error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_ADDRESS_FAILED',
        message: 'Failed to update address',
      },
    });
  }
}

/**
 * Delete an address
 * DELETE /api/profile/addresses/:id
 */
export async function deleteAddress(req, res) {
  try {
    const { id } = req.params;

    const profile = await prisma.profile.findUnique({
      where: { userId: req.user.id },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Profile not found',
        },
      });
    }

    // Verify address belongs to user
    const existingAddress = await prisma.address.findUnique({
      where: { id },
    });

    if (!existingAddress || existingAddress.profileId !== profile.id) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Address not found',
        },
      });
    }

    await prisma.address.delete({
      where: { id },
    });

    logger.info('Address deleted', { userId: req.user.id, addressId: id });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Address deleted successfully',
      },
    });
  } catch (error) {
    logger.error('Delete address error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DELETE_ADDRESS_FAILED',
        message: 'Failed to delete address',
      },
    });
  }
}
