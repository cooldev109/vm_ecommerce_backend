import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Admin: Get all users with pagination
 * GET /api/admin/users
 */
export async function getAllUsers(req, res) {
  try {
    const { page = 1, limit = 50, role, search } = req.query;

    // Build where clause
    const where = {};
    if (role) {
      where.role = role.toUpperCase();
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          _count: {
            select: {
              orders: true
            }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    // Format users
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      phone: user.profile?.phone || '',
      customerType: user.profile?.customerType || 'INDIVIDUAL',
      taxId: user.profile?.taxId || '',
      preferredLanguage: user.profile?.preferredLanguage || 'ES',
      ordersCount: user._count.orders,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        users: formattedUsers,
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
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USERS_FETCH_ERROR',
        message: 'Failed to fetch users'
      }
    });
  }
}

/**
 * Admin: Get all customers with order statistics
 * GET /api/admin/customers
 */
export async function getAllCustomers(req, res) {
  try {
    const { page = 1, limit = 20, search } = req.query;

    // Build where clause
    const where = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Get users with order statistics
    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          orders: {
            select: {
              id: true,
              total: true,
              createdAt: true,
              status: true,
              paymentStatus: true
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    // Calculate customer statistics
    const formattedCustomers = customers.map(customer => {
      const orders = customer.orders;
      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, order) => {
        // Only count paid orders
        if (order.paymentStatus === 'PAID') {
          return sum + parseFloat(order.total);
        }
        return sum;
      }, 0);

      const lastOrder = orders.length > 0 ? orders[0] : null;
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      return {
        id: customer.id,
        email: customer.email,
        role: customer.role,
        firstName: customer.profile?.firstName || '',
        lastName: customer.profile?.lastName || '',
        phone: customer.profile?.phone || '',
        customerType: customer.profile?.customerType || 'INDIVIDUAL',
        totalOrders,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        lastOrderDate: lastOrder?.createdAt || null,
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        registrationDate: customer.createdAt,
        accountStatus: customer.role === 'ADMIN' ? 'ADMIN' : 'ACTIVE'
      };
    });

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        customers: formattedCustomers,
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
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CUSTOMERS_FETCH_ERROR',
        message: 'Failed to fetch customers'
      }
    });
  }
}

/**
 * Admin: Get customer details with full order history
 * GET /api/admin/customers/:userId
 */
export async function getCustomerDetails(req, res) {
  try {
    const { userId } = req.params;

    const customer = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            addresses: true
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CUSTOMER_NOT_FOUND',
          message: 'Customer not found'
        }
      });
    }

    // Calculate lifetime statistics
    const orders = customer.orders;
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.paymentStatus === 'PAID');
    const totalSpent = paidOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const avgOrderValue = paidOrders.length > 0 ? totalSpent / paidOrders.length : 0;
    const lastOrder = orders.length > 0 ? orders[0] : null;

    // Order history with formatted data
    const orderHistory = orders.map(order => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: parseFloat(order.total),
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      itemCount: order.items.length,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const formattedCustomer = {
      id: customer.id,
      email: customer.email,
      role: customer.role,
      profile: {
        firstName: customer.profile?.firstName || '',
        lastName: customer.profile?.lastName || '',
        phone: customer.profile?.phone || '',
        customerType: customer.profile?.customerType || 'INDIVIDUAL',
        taxId: customer.profile?.taxId || '',
        businessName: customer.profile?.businessName || '',
        businessTaxId: customer.profile?.businessTaxId || '',
        preferredLanguage: customer.profile?.preferredLanguage || 'ES',
        addresses: customer.profile?.addresses || []
      },
      statistics: {
        totalOrders,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        avgOrderValue: parseFloat(avgOrderValue.toFixed(2)),
        lastOrderDate: lastOrder?.createdAt || null,
        lifetimeValue: parseFloat(totalSpent.toFixed(2))
      },
      orderHistory,
      registrationDate: customer.createdAt,
      lastActivity: lastOrder?.createdAt || customer.updatedAt
    };

    res.json({
      success: true,
      data: { customer: formattedCustomer }
    });
  } catch (error) {
    logger.error('Error fetching customer details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CUSTOMER_FETCH_ERROR',
        message: 'Failed to fetch customer details'
      }
    });
  }
}

/**
 * Admin: Get customer statistics
 * GET /api/admin/customers/stats
 */
export async function getCustomerStats(req, res) {
  try {
    // Total customers (all users)
    const totalCustomers = await prisma.user.count();

    // New customers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newCustomersThisMonth = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    // Get all users with their order data for calculations
    const usersWithOrders = await prisma.user.findMany({
      include: {
        orders: {
          where: {
            paymentStatus: 'PAID'
          },
          select: {
            total: true,
            createdAt: true
          }
        }
      }
    });

    // Calculate top customers by spending
    const customersWithSpending = usersWithOrders
      .map(user => {
        const totalSpent = user.orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
        return {
          userId: user.id,
          email: user.email,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          orderCount: user.orders.length
        };
      })
      .filter(c => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    // Get user profiles for top customers
    const topCustomers = await Promise.all(
      customersWithSpending.map(async (c) => {
        const user = await prisma.user.findUnique({
          where: { id: c.userId },
          include: { profile: true }
        });
        return {
          id: c.userId,
          name: user?.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : 'Unknown',
          email: c.email,
          totalSpent: c.totalSpent,
          orderCount: c.orderCount
        };
      })
    );

    // Calculate customer retention rate (customers who made more than one purchase)
    const repeatCustomers = usersWithOrders.filter(user => user.orders.length > 1).length;
    const customersWithOrders = usersWithOrders.filter(user => user.orders.length > 0).length;
    const retentionRate = customersWithOrders > 0 ? (repeatCustomers / customersWithOrders) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalCustomers,
        newCustomersThisMonth,
        topCustomers,
        customerRetentionRate: parseFloat(retentionRate.toFixed(2)),
        customersWithOrders,
        repeatCustomers
      }
    });
  } catch (error) {
    logger.error('Error fetching customer stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CUSTOMER_STATS_ERROR',
        message: 'Failed to fetch customer statistics'
      }
    });
  }
}

/**
 * Admin: Get user by ID
 * GET /api/admin/users/:id
 */
export async function getUserById(req, res) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            addresses: true
          }
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            total: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            orders: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    const formattedUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      recentOrders: user.orders,
      totalOrders: user._count.orders,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      data: { user: formattedUser }
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_FETCH_ERROR',
        message: 'Failed to fetch user'
      }
    });
  }
}

/**
 * Admin: Update user role
 * PUT /api/admin/users/:id/role
 * Body: { role: 'USER' | 'ADMIN' }
 */
export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['USER', 'ADMIN'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${validRoles.join(', ')}`
        }
      });
    }

    // Prevent self-demotion
    if (req.user.id === id && role !== 'ADMIN') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DEMOTE_SELF',
          message: 'You cannot change your own admin role'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    await prisma.user.update({
      where: { id },
      data: { role }
    });

    logger.info(`User role updated: ${id} -> ${role} by ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'User role updated successfully',
        role
      }
    });
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_UPDATE_ERROR',
        message: 'Failed to update user role'
      }
    });
  }
}

/**
 * Admin: Create user
 * POST /api/users/admin/create
 * Body: { email, password, role, firstName, lastName, phone, customerType }
 */
export async function createUser(req, res) {
  try {
    const { email, password, role = 'USER', firstName, lastName, phone, customerType = 'INDIVIDUAL' } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists'
        }
      });
    }

    // Hash password
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with profile
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role.toUpperCase(),
        profile: {
          create: {
            firstName: firstName || '',
            lastName: lastName || '',
            phone: phone || '',
            customerType: customerType.toUpperCase()
          }
        }
      },
      include: {
        profile: true
      }
    });

    logger.info(`User created by admin: ${user.id} (${email})`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
          phone: user.profile?.phone,
          customerType: user.profile?.customerType,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_CREATE_ERROR',
        message: 'Failed to create user'
      }
    });
  }
}

/**
 * Admin: Update user profile
 * PUT /api/users/admin/:id
 * Body: { email, firstName, lastName, phone, customerType, taxId }
 */
export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, phone, customerType, taxId } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_EXISTS',
            message: 'This email is already in use'
          }
        });
      }
    }

    // Update user and profile
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(email && { email }),
        profile: {
          update: {
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
            ...(phone !== undefined && { phone }),
            ...(customerType && { customerType: customerType.toUpperCase() }),
            ...(taxId !== undefined && { taxId })
          }
        }
      },
      include: { profile: true }
    });

    logger.info(`User updated by admin: ${id}`);

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          firstName: updatedUser.profile?.firstName,
          lastName: updatedUser.profile?.lastName,
          phone: updatedUser.profile?.phone,
          customerType: updatedUser.profile?.customerType,
          taxId: updatedUser.profile?.taxId,
          updatedAt: updatedUser.updatedAt
        }
      }
    });
  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_UPDATE_ERROR',
        message: 'Failed to update user'
      }
    });
  }
}

/**
 * Admin: Delete user
 * DELETE /api/users/admin/:id
 */
export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CANNOT_DELETE_SELF',
          message: 'You cannot delete your own account'
        }
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Delete user (cascade deletes profile, addresses, cart, etc.)
    await prisma.user.delete({
      where: { id }
    });

    logger.info(`User deleted by admin: ${id} (${user.email})`);

    res.json({
      success: true,
      data: {
        message: 'User deleted successfully',
        deletedUser: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'USER_DELETE_ERROR',
        message: 'Failed to delete user'
      }
    });
  }
}

/**
 * Admin: Get user statistics
 * GET /api/admin/users/stats
 */
export async function getUserStats(req, res) {
  try {
    const [totalUsers, adminCount, usersByType] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.profile.groupBy({
        by: ['customerType'],
        _count: true
      })
    ]);

    // Get new users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const newUsersThisMonth = await prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        adminCount,
        regularUsersCount: totalUsers - adminCount,
        usersByType: usersByType.reduce((acc, item) => {
          acc[item.customerType] = item._count;
          return acc;
        }, {}),
        newUsersThisMonth
      }
    });
  } catch (error) {
    logger.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: 'Failed to fetch user statistics'
      }
    });
  }
}
