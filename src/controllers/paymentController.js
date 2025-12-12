import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';
import { webpayTransaction, WEBPAY_CONFIG } from '../config/webpay.js';

const prisma = new PrismaClient();

/**
 * Initialize Webpay payment for an order
 * POST /api/payments/webpay/init
 * Body: { orderId }
 */
export async function initWebpayPayment(req, res) {
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

    // Create Webpay transaction
    const buyOrder = order.id; // Use order ID as buy order
    const sessionId = userId; // Use user ID as session ID
    const amount = Math.round(parseFloat(order.total)); // Amount must be integer
    const returnUrl = WEBPAY_CONFIG.returnUrl;

    logger.info('Initializing Webpay transaction', {
      orderId,
      amount,
      buyOrder,
      sessionId
    });

    // Call Transbank API to create transaction
    const response = await webpayTransaction.create(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    );

    // Store Webpay token in order
    // Keep payment status as PENDING until Webpay confirms
    await prisma.order.update({
      where: { id: orderId },
      data: {
        webpayToken: response.token
      }
    });

    logger.info('Webpay transaction created', {
      orderId,
      token: response.token
    });

    res.json({
      success: true,
      data: {
        token: response.token,
        url: response.url,
        orderId: order.id
      }
    });
  } catch (error) {
    logger.error('Error initializing Webpay payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBPAY_INIT_ERROR',
        message: 'Failed to initialize payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
}

/**
 * Handle Webpay return callback
 * POST /api/payments/webpay/return
 * Body: { token_ws } (from Transbank)
 */
export async function handleWebpayReturn(req, res) {
  try {
    logger.info('Webpay return received', {
      body: req.body || {},
      query: req.query || {},
      headers: req.headers['content-type']
    });

    const token = (req.body && req.body.token_ws) || (req.query && req.query.token_ws);

    if (!token) {
      logger.error('No token found in request', { body: req.body, query: req.query });
      // Redirect to error page - user cancelled or something went wrong
      const errorUrl = `${WEBPAY_CONFIG.frontendReturnUrl}?status=error`;
      return res.redirect(errorUrl);
    }

    logger.info('Processing Webpay return with token', { token });

    // Commit transaction with Transbank
    logger.info('Calling Transbank commit API');
    let response;
    try {
      response = await webpayTransaction.commit(token);
      logger.info('Transbank commit response received', { response });
    } catch (commitError) {
      logger.error('Transbank commit API error:', {
        error: commitError.message,
        stack: commitError.stack,
        token
      });
      throw commitError;
    }

    logger.info('Webpay transaction committed', {
      token,
      status: response.status,
      buyOrder: response.buy_order,
      authorizationCode: response.authorization_code
    });

    // Find order by webpay token
    const order = await prisma.order.findFirst({
      where: { webpayToken: token }
    });

    if (!order) {
      logger.error('Order not found for Webpay token', { token });
      // Redirect to error page
      const errorUrl = `${WEBPAY_CONFIG.frontendReturnUrl}?status=error`;
      return res.redirect(errorUrl);
    }

    // Check if transaction was approved
    const isApproved = response.status === 'AUTHORIZED' && response.response_code === 0;

    // Update order with payment result
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isApproved ? 'PAID' : 'FAILED',
        status: isApproved ? 'PROCESSING' : order.status,
        webpayTransactionId: response.transaction_date?.toString() || null
      }
    });

    if (isApproved) {
      logger.info('Payment approved', {
        orderId: order.id,
        amount: response.amount,
        authCode: response.authorization_code
      });
    } else {
      logger.warn('Payment rejected or failed', {
        orderId: order.id,
        status: response.status,
        responseCode: response.response_code
      });
    }

    // Redirect to frontend with result
    const redirectUrl = `${WEBPAY_CONFIG.frontendReturnUrl}?orderId=${order.id}&status=${isApproved ? 'success' : 'failed'}`;

    logger.info('Redirecting to frontend', { redirectUrl });

    // Always redirect - this is a Webpay callback endpoint
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error processing Webpay return:', error);

    // Always redirect to frontend with error - this is a Webpay callback endpoint
    const errorUrl = `${WEBPAY_CONFIG.frontendReturnUrl}?status=error`;
    return res.redirect(errorUrl);
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
        hasWebpayToken: !!order.webpayToken,
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
      hasWebpayToken: !!order.webpayToken,
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
