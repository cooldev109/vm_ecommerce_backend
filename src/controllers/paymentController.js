import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';
import { FLOW_CONFIG, createFlowPayment, getFlowPaymentStatus, FLOW_STATUS } from '../config/flow.js';

const prisma = new PrismaClient();

/**
 * Initialize Flow payment for an order
 * POST /api/payments/flow/init
 * Body: { orderId }
 */
export async function initFlowPayment(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ORDER_ID',
          message: 'Order ID is required'
        }
      });
    }

    // Find order and verify ownership
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
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

    // Verify order is pending payment
    if (order.paymentStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_STATUS',
          message: 'Order payment already processed'
        }
      });
    }

    // Use order total (will be $0 if test mode prices are enabled in database)
    const amount = Math.round(parseFloat(order.total));

    logger.info('Initializing Flow payment', {
      orderId,
      amount,
      email: order.email
    });

    // Create Flow payment
    const flowResponse = await createFlowPayment({
      commerceOrder: orderId,
      subject: `Pedido ${orderId}`,
      amount,
      email: order.email,
      urlConfirmation: FLOW_CONFIG.urls.orderConfirm,
      urlReturn: FLOW_CONFIG.urls.orderReturn
    });

    // Store Flow token in order (reusing webpayToken field)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        webpayToken: flowResponse.token
      }
    });

    logger.info('Flow payment created', {
      orderId,
      token: flowResponse.token,
      url: flowResponse.url
    });

    res.json({
      success: true,
      data: {
        token: flowResponse.token,
        url: `${flowResponse.url}?token=${flowResponse.token}`,
        orderId: order.id
      }
    });
  } catch (error) {
    logger.error('Error initializing Flow payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLOW_INIT_ERROR',
        message: 'Failed to initialize payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
}

/**
 * Handle Flow confirmation callback (server-to-server)
 * POST /api/payments/flow/confirm
 * Body: { token } (from Flow)
 */
export async function handleFlowConfirm(req, res) {
  try {
    const { token } = req.body;

    if (!token) {
      logger.error('No token in Flow confirm callback');
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    logger.info('Flow confirm callback received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);

    logger.info('Flow payment status', { flowStatus });

    // Find order by Flow token
    const order = await prisma.order.findFirst({
      where: { webpayToken: token }
    });

    if (!order) {
      logger.error('Order not found for Flow token', { token });
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    // Flow status: 1 = pending, 2 = paid, 3 = rejected, 4 = cancelled
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    // Update order with payment result
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isApproved ? 'PAID' : 'FAILED',
        status: isApproved ? 'PROCESSING' : order.status,
        webpayTransactionId: flowStatus.flowOrder?.toString() || null
      }
    });

    if (isApproved) {
      logger.info('Payment approved', {
        orderId: order.id,
        flowOrder: flowStatus.flowOrder,
        amount: flowStatus.amount
      });
    } else {
      logger.warn('Payment rejected', {
        orderId: order.id,
        status: flowStatus.status
      });
    }

    // Flow expects a simple response
    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing Flow confirm:', error);
    res.status(500).json({ success: false, error: 'Processing error' });
  }
}

/**
 * Handle Flow return callback (user redirect)
 * GET /api/payments/flow/return
 * Query: { token } (from Flow)
 */
export async function handleFlowReturn(req, res) {
  try {
    const { token } = req.query;

    if (!token) {
      logger.error('No token in Flow return');
      return res.redirect(`${FLOW_CONFIG.urls.frontendOrderResult}?status=error`);
    }

    logger.info('Flow return received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);

    // Find order by Flow token
    const order = await prisma.order.findFirst({
      where: { webpayToken: token }
    });

    if (!order) {
      logger.error('Order not found for Flow token', { token });
      return res.redirect(`${FLOW_CONFIG.urls.frontendOrderResult}?status=error`);
    }

    // Flow status: 2 = paid
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    // Redirect to frontend with result
    const redirectUrl = `${FLOW_CONFIG.urls.frontendOrderResult}?orderId=${order.id}&status=${isApproved ? 'success' : 'failed'}`;

    logger.info('Redirecting to frontend', { redirectUrl });

    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error processing Flow return:', error);
    return res.redirect(`${FLOW_CONFIG.urls.frontendOrderResult}?status=error`);
  }
}

/**
 * Get payment status for an order
 * GET /api/payments/order/:orderId
 */
export async function getPaymentStatus(req, res) {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Find order and verify ownership
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        total: true,
        webpayToken: true,
        webpayTransactionId: true,
        createdAt: true,
        updatedAt: true
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

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus,
        total: parseFloat(order.total),
        hasPaymentToken: !!order.webpayToken,
        transactionId: order.webpayTransactionId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_STATUS_ERROR',
        message: 'Failed to fetch payment status'
      }
    });
  }
}

/**
 * Admin: Get all payments with filters
 * GET /api/admin/payments
 */
export async function getAllPayments(req, res) {
  try {
    const { paymentStatus, page = 1, limit = 20 } = req.query;

    // Build where clause
    const where = {};
    if (paymentStatus) {
      where.paymentStatus = paymentStatus.toUpperCase();
    }

    // Get orders with payment info
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          total: true,
          webpayToken: true,
          webpayTransactionId: true,
          firstName: true,
          lastName: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.order.count({ where })
    ]);

    // Format orders
    const formattedPayments = orders.map(order => ({
      orderId: order.id,
      customerName: `${order.firstName} ${order.lastName}`,
      customerEmail: order.email,
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      amount: parseFloat(order.total),
      hasPaymentToken: !!order.webpayToken,
      transactionId: order.webpayTransactionId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));

    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({
      success: true,
      data: {
        payments: formattedPayments,
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
    logger.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENTS_FETCH_ERROR',
        message: 'Failed to fetch payments'
      }
    });
  }
}
