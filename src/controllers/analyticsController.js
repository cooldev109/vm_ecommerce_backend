import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

/**
 * Get comprehensive admin analytics
 * GET /api/admin/analytics
 */
export async function getAnalytics(req, res) {
  try {
    // Get time ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // ============================================
    // REVENUE METRICS
    // ============================================

    // Total revenue (all time - PAID orders only)
    const totalRevenueData = await prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { total: true },
      _count: true
    });

    // This month revenue
    const thisMonthRevenue = await prisma.order.aggregate({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startOfMonth }
      },
      _sum: { total: true },
      _count: true
    });

    // Last month revenue (for comparison)
    const lastMonthRevenue = await prisma.order.aggregate({
      where: {
        paymentStatus: 'PAID',
        createdAt: {
          gte: startOfLastMonth,
          lte: endOfLastMonth
        }
      },
      _sum: { total: true }
    });

    // This week revenue
    const thisWeekRevenue = await prisma.order.aggregate({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: startOfWeek }
      },
      _sum: { total: true }
    });

    // ============================================
    // ORDERS METRICS
    // ============================================

    // Total orders
    const totalOrders = await prisma.order.count();

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true
    });

    // ============================================
    // CUSTOMERS METRICS
    // ============================================

    // Total customers (unique users who placed orders)
    const totalCustomers = await prisma.user.count({
      where: {
        orders: {
          some: {}
        }
      }
    });

    // ============================================
    // PRODUCT ANALYTICS
    // ============================================

    // Top selling products (by quantity sold)
    const topProductsByQuantity = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          paymentStatus: 'PAID'
        }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 10
    });

    // Fetch product details with revenue
    const topProducts = await Promise.all(
      topProductsByQuantity.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: {
            translations: {
              where: { language: 'EN' },
              take: 1
            }
          }
        });

        // Calculate revenue for this product
        const revenue = await prisma.orderItem.aggregate({
          where: {
            productId: item.productId,
            order: {
              paymentStatus: 'PAID'
            }
          },
          _sum: {
            price: true
          }
        });

        return {
          productId: item.productId,
          name: product?.translations[0]?.name || product?.id || 'Unknown',
          category: product?.category || 'UNKNOWN',
          image: product?.image || '',
          quantitySold: item._sum.quantity || 0,
          revenue: parseFloat(revenue._sum.price || 0) * (item._sum.quantity || 0)
        };
      })
    );

    // Revenue by category
    const revenueByCategory = await prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          paymentStatus: 'PAID'
        }
      },
      _sum: {
        price: true,
        quantity: true
      }
    });

    // Aggregate by category
    const categoryRevenue = {};
    for (const item of revenueByCategory) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { category: true }
      });

      if (product) {
        const category = product.category;
        const revenue = parseFloat(item._sum.price || 0) * (item._sum.quantity || 0);
        categoryRevenue[category] = (categoryRevenue[category] || 0) + revenue;
      }
    }

    // ============================================
    // SALES OVER TIME (Last 30 Days)
    // ============================================

    const salesOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const dayRevenue = await prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: {
            gte: date,
            lt: nextDate
          }
        },
        _sum: {
          total: true
        },
        _count: true
      });

      salesOverTime.push({
        date: date.toISOString().split('T')[0],
        revenue: parseFloat(dayRevenue._sum.total || 0),
        orders: dayRevenue._count
      });
    }

    // ============================================
    // RECENT ORDERS
    // ============================================

    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                translations: {
                  where: { language: 'EN' },
                  take: 1
                }
              }
            }
          }
        }
      }
    });

    // Format recent orders
    const formattedRecentOrders = recentOrders.map(order => ({
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: parseFloat(order.total),
      customerName: `${order.firstName} ${order.lastName}`,
      email: order.email,
      itemCount: order.items.length,
      createdAt: order.createdAt
    }));

    // ============================================
    // AVERAGE ORDER VALUE
    // ============================================

    const avgOrderValue = totalRevenueData._count > 0
      ? parseFloat(totalRevenueData._sum.total || 0) / totalRevenueData._count
      : 0;

    // ============================================
    // GROWTH CALCULATIONS
    // ============================================

    const thisMonthRev = parseFloat(thisMonthRevenue._sum.total || 0);
    const lastMonthRev = parseFloat(lastMonthRevenue._sum.total || 0);
    const revenueGrowth = lastMonthRev > 0
      ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100
      : 0;

    // ============================================
    // RESPONSE
    // ============================================

    res.json({
      success: true,
      data: {
        revenue: {
          total: parseFloat(totalRevenueData._sum.total || 0),
          thisMonth: thisMonthRev,
          lastMonth: lastMonthRev,
          thisWeek: parseFloat(thisWeekRevenue._sum.total || 0),
          growth: parseFloat(revenueGrowth.toFixed(2)),
          avgOrderValue: parseFloat(avgOrderValue.toFixed(2))
        },
        orders: {
          total: totalOrders,
          thisMonth: thisMonthRevenue._count,
          paid: totalRevenueData._count,
          byStatus: ordersByStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {})
        },
        customers: {
          total: totalCustomers
        },
        topProducts,
        revenueByCategory: Object.entries(categoryRevenue).map(([category, revenue]) => ({
          category,
          revenue: parseFloat(revenue.toFixed(2))
        })),
        salesOverTime,
        recentOrders: formattedRecentOrders
      }
    });

  } catch (error) {
    logger.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to fetch analytics data'
      }
    });
  }
}
