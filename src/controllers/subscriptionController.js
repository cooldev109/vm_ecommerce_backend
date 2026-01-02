import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();
import { webpayTransaction, WEBPAY_CONFIG } from '../config/webpay.js';

// Subscription pricing (in Chilean Pesos)
export const SUBSCRIPTION_PRICES = {
  MONTHLY: 9990,   // ~$13 USD
  QUARTERLY: 25990, // ~$34 USD (13% discount)
  ANNUAL: 89990     // ~$117 USD (25% discount)
};

// Get all subscription plans with pricing
export const getSubscriptionPlans = async (req, res) => {
  try {
    const plans = [
      {
        id: 'MONTHLY',
        name: 'Monthly Premium',
        nameEs: 'Premium Mensual',
        price: SUBSCRIPTION_PRICES.MONTHLY,
        billingPeriod: 'month',
        billingPeriodEs: 'mes',
        features: [
          'Unlimited access to all audio experiences',
          'Early access to new candle releases',
          'Exclusive meditation and relaxation content',
          '10% discount on all purchases',
          'Priority customer support'
        ],
        featuresEs: [
          'Acceso ilimitado a todas las experiencias de audio',
          'Acceso anticipado a nuevos lanzamientos de velas',
          'Contenido exclusivo de meditación y relajación',
          '10% de descuento en todas las compras',
          'Soporte al cliente prioritario'
        ]
      },
      {
        id: 'QUARTERLY',
        name: 'Quarterly Premium',
        nameEs: 'Premium Trimestral',
        price: SUBSCRIPTION_PRICES.QUARTERLY,
        billingPeriod: '3 months',
        billingPeriodEs: '3 meses',
        savings: Math.round((SUBSCRIPTION_PRICES.MONTHLY * 3 - SUBSCRIPTION_PRICES.QUARTERLY)),
        features: [
          'All Monthly Premium features',
          'Save 13% compared to monthly',
          'Exclusive quarterly curated playlists',
          'Free shipping on all orders',
          'Birthday gift - special candle'
        ],
        featuresEs: [
          'Todas las características del Premium Mensual',
          'Ahorra 13% comparado con mensual',
          'Listas de reproducción exclusivas trimestrales',
          'Envío gratis en todos los pedidos',
          'Regalo de cumpleaños - vela especial'
        ],
        popular: true
      },
      {
        id: 'ANNUAL',
        name: 'Annual Premium',
        nameEs: 'Premium Anual',
        price: SUBSCRIPTION_PRICES.ANNUAL,
        billingPeriod: 'year',
        billingPeriodEs: 'año',
        savings: Math.round((SUBSCRIPTION_PRICES.MONTHLY * 12 - SUBSCRIPTION_PRICES.ANNUAL)),
        features: [
          'All Quarterly Premium features',
          'Save 25% compared to monthly',
          'Exclusive annual member events',
          'Free candle every quarter',
          'Lifetime 15% discount on all products',
          'Personalized scent consultation'
        ],
        featuresEs: [
          'Todas las características del Premium Trimestral',
          'Ahorra 25% comparado con mensual',
          'Eventos exclusivos para miembros anuales',
          'Vela gratis cada trimestre',
          'Descuento permanente del 15% en todos los productos',
          'Consulta de fragancias personalizada'
        ],
        bestValue: true
      }
    ];

    res.json({
      success: true,
      data: { plans }
    });
  } catch (error) {
    logger.error('Error fetching subscription plans:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PLANS_FETCH_ERROR',
        message: 'Failed to fetch subscription plans'
      }
    });
  }
};

// Get user's current subscription
export const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: ['ACTIVE', 'PAUSED']
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!subscription) {
      return res.json({
        success: true,
        data: { subscription: null }
      });
    }

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    logger.error('Error fetching user subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_FETCH_ERROR',
        message: 'Failed to fetch subscription'
      }
    });
  }
};

// Create a new subscription (pending payment)
export const createSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    // Validate plan
    if (!['MONTHLY', 'QUARTERLY', 'ANNUAL'].includes(planId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan'
        }
      });
    }

    // Check if user already has an active subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE'
      }
    });

    if (existingSubscription) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_EXISTS',
          message: 'User already has an active subscription'
        }
      });
    }

    // Cancel any pending subscriptions
    await prisma.subscription.updateMany({
      where: {
        userId,
        paymentStatus: 'PENDING'
      },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'CANCELLED'
      }
    });

    const amount = SUBSCRIPTION_PRICES[planId];

    // Create subscription with pending payment status
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        status: 'CANCELLED', // Will be activated after payment
        autoRenew: true,
        paymentMethod: 'webpay',
        paymentStatus: 'PENDING',
        amount
      }
    });

    logger.info(`Subscription created (pending payment) for user ${userId}: ${subscription.id}`);

    res.json({
      success: true,
      data: {
        subscription,
        requiresPayment: true,
        amount
      }
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CREATE_ERROR',
        message: 'Failed to create subscription'
      }
    });
  }
};

// Initialize Webpay payment for subscription
export const initSubscriptionPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SUBSCRIPTION_ID',
          message: 'Subscription ID is required'
        }
      });
    }

    // Find subscription and verify ownership
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    // Verify subscription is pending payment
    if (subscription.paymentStatus !== 'PENDING') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_STATUS',
          message: 'Subscription payment already processed'
        }
      });
    }

    const amount = subscription.amount || SUBSCRIPTION_PRICES[subscription.planId];

    // Create Webpay transaction
    const buyOrder = `SUB-${subscription.id.substring(0, 20)}`; // Prefix with SUB to identify subscription payments
    const sessionId = userId;
    const returnUrl = `${WEBPAY_CONFIG.returnUrl.replace('/payments/webpay/return', '/subscriptions/webpay/return')}`;

    logger.info('Initializing Webpay transaction for subscription', {
      subscriptionId,
      amount,
      buyOrder,
      sessionId,
      returnUrl
    });

    // Call Transbank API to create transaction
    const response = await webpayTransaction.create(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    );

    // Store Webpay token in subscription
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        webpayToken: response.token
      }
    });

    logger.info('Webpay transaction created for subscription', {
      subscriptionId,
      token: response.token
    });

    res.json({
      success: true,
      data: {
        token: response.token,
        url: response.url,
        subscriptionId: subscription.id
      }
    });
  } catch (error) {
    logger.error('Error initializing subscription payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBPAY_INIT_ERROR',
        message: 'Failed to initialize payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
};

// Handle Webpay return callback for subscription
export const handleSubscriptionWebpayReturn = async (req, res) => {
  try {
    logger.info('Subscription Webpay return received', {
      body: req.body || {},
      query: req.query || {},
      headers: req.headers['content-type']
    });

    const token = (req.body && req.body.token_ws) || (req.query && req.query.token_ws);

    if (!token) {
      logger.error('No token found in subscription payment request', { body: req.body, query: req.query });
      const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error&message=missing_token`;
      return res.redirect(errorUrl);
    }

    logger.info('Processing subscription Webpay return with token', { token });

    // Commit transaction with Transbank
    let response;
    try {
      response = await webpayTransaction.commit(token);
      logger.info('Transbank commit response received for subscription', { response });
    } catch (commitError) {
      logger.error('Transbank commit API error for subscription:', {
        error: commitError.message,
        stack: commitError.stack,
        token
      });
      throw commitError;
    }

    // Find subscription by webpay token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for Webpay token', { token });
      const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error&message=subscription_not_found`;
      return res.redirect(errorUrl);
    }

    // Check if transaction was approved
    const isApproved = response.status === 'AUTHORIZED' && response.response_code === 0;

    if (isApproved) {
      // Calculate expiry date based on plan
      const startDate = new Date();
      const expiryDate = new Date(startDate);

      switch (subscription.planId) {
        case 'MONTHLY':
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          break;
        case 'ANNUAL':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          break;
      }

      // Activate subscription
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          startedAt: startDate,
          expiresAt: expiryDate,
          nextRenewal: expiryDate,
          lastPaymentDate: startDate,
          webpayTransactionId: response.transaction_date?.toString() || null
        }
      });

      logger.info('Subscription payment approved and activated', {
        subscriptionId: subscription.id,
        amount: response.amount,
        authCode: response.authorization_code
      });

      const successUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?subscriptionId=${subscription.id}&status=success`;
      return res.redirect(successUrl);
    } else {
      // Payment failed
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'FAILED',
          webpayTransactionId: response.transaction_date?.toString() || null
        }
      });

      logger.warn('Subscription payment rejected or failed', {
        subscriptionId: subscription.id,
        status: response.status,
        responseCode: response.response_code
      });

      const failedUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?subscriptionId=${subscription.id}&status=failed`;
      return res.redirect(failedUrl);
    }
  } catch (error) {
    logger.error('Error processing subscription Webpay return:', error);
    const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error`;
    return res.redirect(errorUrl);
  }
};

// Get subscription payment status
export const getSubscriptionPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      },
      select: {
        id: true,
        planId: true,
        status: true,
        paymentStatus: true,
        amount: true,
        webpayToken: true,
        webpayTransactionId: true,
        startedAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        paymentStatus: subscription.paymentStatus,
        amount: subscription.amount,
        hasWebpayToken: !!subscription.webpayToken,
        transactionId: subscription.webpayTransactionId,
        startedAt: subscription.startedAt,
        expiresAt: subscription.expiresAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription payment status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PAYMENT_STATUS_ERROR',
        message: 'Failed to fetch payment status'
      }
    });
  }
};

// Update subscription (change plan, toggle auto-renew)
export const updateSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;
    const { autoRenew, newPlanId } = req.body;

    // Find subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to update this subscription'
        }
      });
    }

    const updateData = {};

    // Update auto-renew
    if (typeof autoRenew === 'boolean') {
      updateData.autoRenew = autoRenew;
    }

    // Change plan (upgrade/downgrade)
    if (newPlanId && ['MONTHLY', 'QUARTERLY', 'ANNUAL'].includes(newPlanId)) {
      updateData.planId = newPlanId;

      // Recalculate next renewal based on new plan
      const currentDate = new Date();
      const newExpiryDate = new Date(currentDate);

      switch (newPlanId) {
        case 'MONTHLY':
          newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
          break;
        case 'ANNUAL':
          newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
          break;
      }

      updateData.nextRenewal = newExpiryDate;
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData
    });

    logger.info(`Subscription updated: ${subscriptionId}`);

    res.json({
      success: true,
      data: { subscription: updatedSubscription }
    });
  } catch (error) {
    logger.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_UPDATE_ERROR',
        message: 'Failed to update subscription'
      }
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    // Find subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to cancel this subscription'
        }
      });
    }

    // Update subscription status to CANCELLED
    const cancelledSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'CANCELLED',
        autoRenew: false
      }
    });

    logger.info(`Subscription cancelled: ${subscriptionId}`);

    res.json({
      success: true,
      data: { subscription: cancelledSubscription }
    });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CANCEL_ERROR',
        message: 'Failed to cancel subscription'
      }
    });
  }
};

// Pause subscription
export const pauseSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to pause this subscription'
        }
      });
    }

    const pausedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'PAUSED',
        autoRenew: false
      }
    });

    logger.info(`Subscription paused: ${subscriptionId}`);

    res.json({
      success: true,
      data: { subscription: pausedSubscription }
    });
  } catch (error) {
    logger.error('Error pausing subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_PAUSE_ERROR',
        message: 'Failed to pause subscription'
      }
    });
  }
};

// Resume paused subscription
export const resumeSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    if (subscription.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to resume this subscription'
        }
      });
    }

    if (subscription.status !== 'PAUSED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Can only resume paused subscriptions'
        }
      });
    }

    const resumedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        autoRenew: true
      }
    });

    logger.info(`Subscription resumed: ${subscriptionId}`);

    res.json({
      success: true,
      data: { subscription: resumedSubscription }
    });
  } catch (error) {
    logger.error('Error resuming subscription:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_RESUME_ERROR',
        message: 'Failed to resume subscription'
      }
    });
  }
};

// Admin: Get all subscriptions with pagination
export const getAllSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        include: {
          user: {
            include: {
              profile: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.subscription.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching all subscriptions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTIONS_FETCH_ERROR',
        message: 'Failed to fetch subscriptions'
      }
    });
  }
};

// Admin: Get subscription analytics
export const getSubscriptionAnalytics = async (req, res) => {
  try {
    const [
      totalActive,
      totalCancelled,
      totalPaused,
      totalExpired,
      monthlyCount,
      quarterlyCount,
      annualCount,
      recentSubscriptions
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'CANCELLED' } }),
      prisma.subscription.count({ where: { status: 'PAUSED' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { planId: 'MONTHLY', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { planId: 'QUARTERLY', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { planId: 'ANNUAL', status: 'ACTIVE' } }),
      prisma.subscription.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            include: {
              profile: true
            }
          }
        }
      })
    ]);

    // Calculate Monthly Recurring Revenue (MRR)
    const monthlyMRR = monthlyCount * SUBSCRIPTION_PRICES.MONTHLY;
    const quarterlyMRR = quarterlyCount * (SUBSCRIPTION_PRICES.QUARTERLY / 3);
    const annualMRR = annualCount * (SUBSCRIPTION_PRICES.ANNUAL / 12);
    const totalMRR = monthlyMRR + quarterlyMRR + annualMRR;

    res.json({
      success: true,
      data: {
        summary: {
          totalActive,
          totalCancelled,
          totalPaused,
          totalExpired,
          totalSubscriptions: totalActive + totalCancelled + totalPaused + totalExpired
        },
        planBreakdown: {
          monthly: monthlyCount,
          quarterly: quarterlyCount,
          annual: annualCount
        },
        revenue: {
          mrr: Math.round(totalMRR),
          arr: Math.round(totalMRR * 12),
          currency: 'CLP'
        },
        recentSubscriptions
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_FETCH_ERROR',
        message: 'Failed to fetch subscription analytics'
      }
    });
  }
};

// Upgrade subscription to a higher plan with payment
export const upgradeSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId } = req.params;
    const { newPlanId } = req.body;

    // Validate new plan
    if (!['MONTHLY', 'QUARTERLY', 'ANNUAL'].includes(newPlanId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN',
          message: 'Invalid subscription plan'
        }
      });
    }

    // Find current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    // Verify ownership
    if (subscription.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Not authorized to upgrade this subscription'
        }
      });
    }

    // Only active subscriptions can be upgraded
    if (subscription.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Only active subscriptions can be upgraded'
        }
      });
    }

    // Can't upgrade to the same plan
    if (subscription.planId === newPlanId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SAME_PLAN',
          message: 'Already subscribed to this plan'
        }
      });
    }

    // Calculate plan hierarchy (higher = better)
    const planHierarchy = { MONTHLY: 1, QUARTERLY: 2, ANNUAL: 3 };
    const currentPlanLevel = planHierarchy[subscription.planId];
    const newPlanLevel = planHierarchy[newPlanId];
    const isUpgrade = newPlanLevel > currentPlanLevel;

    // Calculate price difference
    const currentPrice = SUBSCRIPTION_PRICES[subscription.planId];
    const newPrice = SUBSCRIPTION_PRICES[newPlanId];

    // For upgrades, charge the difference; for downgrades, no payment needed (just change at next renewal)
    let upgradeAmount = 0;
    let immediateChange = false;

    if (isUpgrade) {
      // Calculate prorated amount based on remaining time
      const now = new Date();
      const expiresAt = new Date(subscription.expiresAt);
      const startedAt = new Date(subscription.startedAt);

      // Calculate what percentage of the current billing period is remaining
      const totalPeriodMs = expiresAt.getTime() - startedAt.getTime();
      const remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const remainingRatio = remainingMs / totalPeriodMs;

      // Calculate credit from current plan (unused portion)
      const credit = Math.round(currentPrice * remainingRatio);

      // Charge full price of new plan minus credit
      upgradeAmount = Math.max(0, newPrice - credit);
      immediateChange = true;
    } else {
      // Downgrade: Change will take effect at next renewal, no payment needed
      immediateChange = false;
      upgradeAmount = 0;
    }

    // Create a pending upgrade record
    const upgrade = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        // Store upgrade info but don't change plan yet until payment (for upgrades)
        // For downgrades, just schedule the change
        ...(immediateChange ? {} : { planId: newPlanId }),
        paymentStatus: immediateChange ? 'PENDING' : 'PAID',
      }
    });

    logger.info(`Subscription upgrade initiated: ${subscriptionId} from ${subscription.planId} to ${newPlanId}`, {
      isUpgrade,
      upgradeAmount,
      immediateChange
    });

    res.json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        currentPlan: subscription.planId,
        newPlan: newPlanId,
        isUpgrade,
        upgradeAmount,
        requiresPayment: isUpgrade && upgradeAmount > 0,
        effectiveImmediately: immediateChange,
        message: isUpgrade
          ? 'Payment required to complete upgrade'
          : 'Your plan will change at the next renewal date'
      }
    });
  } catch (error) {
    logger.error('Error initiating subscription upgrade:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPGRADE_ERROR',
        message: 'Failed to initiate subscription upgrade'
      }
    });
  }
};

// Initialize payment for subscription upgrade
export const initUpgradePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId, newPlanId, amount } = req.body;

    if (!subscriptionId || !newPlanId || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Subscription ID, new plan ID, and amount are required'
        }
      });
    }

    // Find subscription and verify ownership
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SUBSCRIPTION_NOT_FOUND',
          message: 'Subscription not found'
        }
      });
    }

    // Create Webpay transaction for upgrade
    const buyOrder = `UPG-${subscription.id.substring(0, 20)}`; // Prefix with UPG to identify upgrade payments
    // Use pipe separator to avoid conflict with UUID dashes
    const sessionId = `${subscriptionId}|${newPlanId}`;
    // Use backend base URL to construct return URL for upgrades
    const backendBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const returnUrl = `${backendBaseUrl}/api/subscriptions/upgrade/webpay/return`;

    logger.info('Initializing Webpay transaction for subscription upgrade', {
      subscriptionId,
      newPlanId,
      amount,
      buyOrder,
      sessionId,
      returnUrl
    });

    // Call Transbank API to create transaction
    const response = await webpayTransaction.create(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    );

    // Store upgrade info temporarily (will be processed after payment)
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        webpayToken: response.token,
        // Store new plan ID in a way we can retrieve it - using amount field temporarily
        // In production, you'd want a separate SubscriptionUpgrade table
      }
    });

    // Store upgrade details in session/cache (in production use Redis or similar)
    // For simplicity, we'll encode it in the session ID

    logger.info('Webpay transaction created for subscription upgrade', {
      subscriptionId,
      newPlanId,
      token: response.token
    });

    res.json({
      success: true,
      data: {
        token: response.token,
        url: response.url,
        subscriptionId: subscription.id,
        newPlanId,
        amount
      }
    });
  } catch (error) {
    logger.error('Error initializing upgrade payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBPAY_INIT_ERROR',
        message: 'Failed to initialize upgrade payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
};

// Handle Webpay return callback for subscription upgrade
export const handleUpgradeWebpayReturn = async (req, res) => {
  try {
    logger.info('Subscription upgrade Webpay return received', {
      body: req.body || {},
      query: req.query || {},
      headers: req.headers['content-type']
    });

    const token = (req.body && req.body.token_ws) || (req.query && req.query.token_ws);

    if (!token) {
      logger.error('No token found in upgrade payment request', { body: req.body, query: req.query });
      const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error&message=missing_token`;
      return res.redirect(errorUrl);
    }

    logger.info('Processing upgrade Webpay return with token', { token });

    // Commit transaction with Transbank
    let response;
    try {
      response = await webpayTransaction.commit(token);
      logger.info('Transbank commit response received for upgrade', { response });
    } catch (commitError) {
      logger.error('Transbank commit API error for upgrade:', {
        error: commitError.message,
        stack: commitError.stack,
        token
      });
      throw commitError;
    }

    // Find subscription by webpay token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for upgrade Webpay token', { token });
      const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error&message=subscription_not_found`;
      return res.redirect(errorUrl);
    }

    // Check if transaction was approved
    const isApproved = response.status === 'AUTHORIZED' && response.response_code === 0;

    if (isApproved) {
      // Determine the new plan from the buy order or session
      // The sessionId format is: subscriptionId|newPlanId
      const sessionParts = response.session_id?.split('|') || [];
      const newPlanId = sessionParts[1] || 'ANNUAL'; // Default to ANNUAL if parsing fails

      // Calculate new expiry date based on new plan
      const startDate = new Date();
      const expiryDate = new Date(startDate);

      switch (newPlanId) {
        case 'MONTHLY':
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
          break;
        case 'ANNUAL':
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          break;
      }

      // Update subscription with new plan
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: newPlanId,
          status: 'ACTIVE',
          paymentStatus: 'PAID',
          startedAt: startDate,
          expiresAt: expiryDate,
          nextRenewal: expiryDate,
          lastPaymentDate: startDate,
          amount: SUBSCRIPTION_PRICES[newPlanId],
          webpayTransactionId: response.transaction_date?.toString() || null
        }
      });

      logger.info('Subscription upgrade payment approved and applied', {
        subscriptionId: subscription.id,
        newPlanId,
        amount: response.amount,
        authCode: response.authorization_code
      });

      const successUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?subscriptionId=${subscription.id}&status=upgraded&plan=${newPlanId}`;
      return res.redirect(successUrl);
    } else {
      // Payment failed
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'PAID', // Keep as paid since original subscription is still active
          webpayToken: null // Clear the token
        }
      });

      logger.warn('Subscription upgrade payment rejected or failed', {
        subscriptionId: subscription.id,
        status: response.status,
        responseCode: response.response_code
      });

      const failedUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?subscriptionId=${subscription.id}&status=upgrade_failed`;
      return res.redirect(failedUrl);
    }
  } catch (error) {
    logger.error('Error processing upgrade Webpay return:', error);
    const errorUrl = `${WEBPAY_CONFIG.frontendSubscriptionUrl}?status=error`;
    return res.redirect(errorUrl);
  }
};

// Cron job function: Process subscription renewals
export const processSubscriptionRenewals = async () => {
  try {
    const now = new Date();

    // Find subscriptions that need renewal
    const subscriptionsToRenew = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        nextRenewal: {
          lte: now
        }
      },
      include: {
        user: true
      }
    });

    logger.info(`Processing ${subscriptionsToRenew.length} subscription renewals`);

    for (const subscription of subscriptionsToRenew) {
      try {
        // Calculate new expiry date
        const newExpiryDate = new Date(subscription.nextRenewal);

        switch (subscription.planId) {
          case 'MONTHLY':
            newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
            break;
          case 'QUARTERLY':
            newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
            break;
          case 'ANNUAL':
            newExpiryDate.setFullYear(newExpiryDate.getFullYear() + 1);
            break;
        }

        // Here you would process the payment through Transbank
        // For now, we'll just update the subscription

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            nextRenewal: newExpiryDate,
            expiresAt: newExpiryDate,
            lastPaymentDate: now
          }
        });

        logger.info(`Renewed subscription ${subscription.id} for user ${subscription.userId}`);
      } catch (error) {
        logger.error(`Failed to renew subscription ${subscription.id}:`, error);

        // Mark subscription as expired if renewal fails
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'EXPIRED',
            autoRenew: false
          }
        });
      }
    }

    // Mark expired subscriptions
    await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: {
          lt: now
        }
      },
      data: {
        status: 'EXPIRED',
        autoRenew: false
      }
    });

    logger.info('Subscription renewal processing completed');
  } catch (error) {
    logger.error('Error processing subscription renewals:', error);
  }
};
