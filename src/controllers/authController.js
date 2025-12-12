import { PrismaClient } from '../generated/prisma/index.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Register a new user
 * POST /api/auth/register
 */
export async function register(req, res) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      customerType,
      taxId,
      preferredLanguage,
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
        },
      });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'USER',
        profile: {
          create: {
            firstName,
            lastName,
            phone: phone || null,
            customerType,
            taxId: taxId || null,
            preferredLanguage,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User registered successfully', { userId: user.id, email: user.email });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phone: user.profile.phone,
            customerType: user.profile.customerType,
            preferredLanguage: user.profile.preferredLanguage,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register user',
      },
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Compare passwords
    const passwordMatch = await comparePassword(password, user.passwordHash);

    if (!passwordMatch) {
      logger.warn('Failed login attempt', { email });
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User logged in successfully', { userId: user.id, email: user.email });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          profile: user.profile ? {
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phone: user.profile.phone,
            customerType: user.profile.customerType,
            preferredLanguage: user.profile.preferredLanguage,
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Failed to login',
      },
    });
  }
}

/**
 * Get current user
 * GET /api/auth/me
 * Requires authentication
 */
export async function getMe(req, res) {
  try {
    // User is already attached by authenticate middleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: {
          include: {
            addresses: true,
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

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          profile: user.profile ? {
            id: user.profile.id,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phone: user.profile.phone,
            customerType: user.profile.customerType,
            taxId: user.profile.taxId,
            preferredLanguage: user.profile.preferredLanguage,
            addresses: user.profile.addresses,
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('Get me error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'FETCH_USER_FAILED',
        message: 'Failed to fetch user data',
      },
    });
  }
}

/**
 * Logout user (client-side token removal)
 * POST /api/auth/logout
 * Requires authentication
 */
export async function logout(req, res) {
  try {
    logger.info('User logged out', { userId: req.user.id });

    return res.status(200).json({
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout',
      },
    });
  }
}
