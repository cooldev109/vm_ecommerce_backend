import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../config/logger.js';
import { FLOW_CONFIG, createFlowPayment, getFlowPaymentStatus, FLOW_STATUS } from '../config/flow.js';

const prisma = new PrismaClient();

// Default subscription pricing (in Chilean Pesos) - used as fallback if DB is empty
const DEFAULT_SUBSCRIPTION_PRICES = {
  WEEKLY: 2990,     // ~$4 USD per week
  MONTHLY: 9990,    // ~$13 USD per month (16% discount vs weekly)
  QUARTERLY: 25990  // ~$34 USD per quarter (28% discount vs weekly)
};

// Cache for subscription prices (loaded from DB)
let subscriptionPricesCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

// Get subscription prices from database or cache
export const getSubscriptionPrices = async () => {
  const now = Date.now();
  if (subscriptionPricesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return subscriptionPricesCache;
  }

  try {
    const configs = await prisma.subscriptionPlanConfig.findMany({
      where: { isActive: true }
    });

    if (configs.length > 0) {
      const prices = {};
      configs.forEach(config => {
        prices[config.id] = config.price;
      });
      subscriptionPricesCache = prices;
      cacheTimestamp = now;
      return prices;
    }
  } catch (error) {
    logger.warn('Failed to load subscription prices from DB, using defaults:', error.message);
  }

  return DEFAULT_SUBSCRIPTION_PRICES;
};

// Export for backwards compatibility
export const SUBSCRIPTION_PRICES = DEFAULT_SUBSCRIPTION_PRICES;

// Get all subscription plans with pricing (from database)
export const getSubscriptionPlans = async (req, res) => {
  try {
    // Try to get plans from database
    let configs = await prisma.subscriptionPlanConfig.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' }
    });

    // If no configs in DB, return default plans
    if (configs.length === 0) {
      const plans = getDefaultPlans();
      return res.json({
        success: true,
        data: { plans }
      });
    }

    // Get weekly price for savings calculation
    const weeklyConfig = configs.find(c => c.id === 'WEEKLY');
    const weeklyPrice = weeklyConfig?.price || DEFAULT_SUBSCRIPTION_PRICES.WEEKLY;

    // Format plans from database configs
    const plans = configs.map(config => {
      let savings = 0;
      if (config.id === 'MONTHLY') {
        // Monthly vs 4 weeks of weekly
        savings = Math.round(weeklyPrice * 4 - config.price);
      } else if (config.id === 'QUARTERLY') {
        // Quarterly vs 12 weeks of weekly
        savings = Math.round(weeklyPrice * 12 - config.price);
      }

      return {
        id: config.id,
        name: config.nameEn,
        nameEs: config.nameEs,
        price: config.price,
        billingPeriod: config.billingPeriodEn,
        billingPeriodEs: config.billingPeriodEs,
        features: config.featuresEn,
        featuresEs: config.featuresEs,
        savings: savings > 0 ? savings : undefined,
        popular: config.isPopular,
        bestValue: config.isBestValue
      };
    });

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

// Default plans for backwards compatibility
function getDefaultPlans() {
  return [
    {
      id: 'WEEKLY',
      name: 'Weekly Premium',
      nameEs: 'Premium Semanal',
      price: DEFAULT_SUBSCRIPTION_PRICES.WEEKLY,
      billingPeriod: 'week',
      billingPeriodEs: 'semana',
      features: [
        'Access to basic audio experiences',
        'Try before committing long-term',
        'Basic meditation content',
        '5% discount on purchases',
        'Email support'
      ],
      featuresEs: [
        'Acceso a experiencias de audio básicas',
        'Prueba antes de comprometerte a largo plazo',
        'Contenido básico de meditación',
        '5% de descuento en compras',
        'Soporte por email'
      ]
    },
    {
      id: 'MONTHLY',
      name: 'Monthly Premium',
      nameEs: 'Premium Mensual',
      price: DEFAULT_SUBSCRIPTION_PRICES.MONTHLY,
      billingPeriod: 'month',
      billingPeriodEs: 'mes',
      savings: Math.round((DEFAULT_SUBSCRIPTION_PRICES.WEEKLY * 4 - DEFAULT_SUBSCRIPTION_PRICES.MONTHLY)),
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
      ],
      popular: true
    },
    {
      id: 'QUARTERLY',
      name: 'Quarterly Premium',
      nameEs: 'Premium Trimestral',
      price: DEFAULT_SUBSCRIPTION_PRICES.QUARTERLY,
      billingPeriod: '3 months',
      billingPeriodEs: '3 meses',
      savings: Math.round((DEFAULT_SUBSCRIPTION_PRICES.WEEKLY * 12 - DEFAULT_SUBSCRIPTION_PRICES.QUARTERLY)),
      features: [
        'All Monthly Premium features',
        'Save 28% compared to weekly',
        'Exclusive quarterly curated playlists',
        'Free shipping on all orders',
        'Birthday gift - special candle',
        'Personalized scent consultation'
      ],
      featuresEs: [
        'Todas las características del Premium Mensual',
        'Ahorra 28% comparado con semanal',
        'Listas de reproducción exclusivas trimestrales',
        'Envío gratis en todos los pedidos',
        'Regalo de cumpleaños - vela especial',
        'Consulta de fragancias personalizada'
      ],
      bestValue: true
    }
  ];
}

// ============ ADMIN FUNCTIONS ============

// Get all plan configs (Admin)
export const getAdminPlanConfigs = async (req, res) => {
  try {
    const configs = await prisma.subscriptionPlanConfig.findMany({
      orderBy: { sortOrder: 'asc' }
    });

    res.json({
      success: true,
      data: { plans: configs }
    });
  } catch (error) {
    logger.error('Error fetching plan configs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PLANS_FETCH_ERROR',
        message: 'Failed to fetch plan configurations'
      }
    });
  }
};

// Update plan config (Admin)
export const updatePlanConfig = async (req, res) => {
  try {
    const { planId } = req.params;
    const {
      price,
      nameEn,
      nameEs,
      billingPeriodEn,
      billingPeriodEs,
      featuresEn,
      featuresEs,
      isPopular,
      isBestValue,
      isActive,
      sortOrder
    } = req.body;

    // Validate planId
    if (!['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(planId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PLAN_ID',
          message: 'Invalid plan ID'
        }
      });
    }

    // Upsert the plan config
    const config = await prisma.subscriptionPlanConfig.upsert({
      where: { id: planId },
      update: {
        price: price !== undefined ? price : undefined,
        nameEn: nameEn !== undefined ? nameEn : undefined,
        nameEs: nameEs !== undefined ? nameEs : undefined,
        billingPeriodEn: billingPeriodEn !== undefined ? billingPeriodEn : undefined,
        billingPeriodEs: billingPeriodEs !== undefined ? billingPeriodEs : undefined,
        featuresEn: featuresEn !== undefined ? featuresEn : undefined,
        featuresEs: featuresEs !== undefined ? featuresEs : undefined,
        isPopular: isPopular !== undefined ? isPopular : undefined,
        isBestValue: isBestValue !== undefined ? isBestValue : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined
      },
      create: {
        id: planId,
        price: price || DEFAULT_SUBSCRIPTION_PRICES[planId],
        nameEn: nameEn || `${planId.charAt(0) + planId.slice(1).toLowerCase()} Premium`,
        nameEs: nameEs || `Premium ${planId.charAt(0) + planId.slice(1).toLowerCase()}`,
        billingPeriodEn: billingPeriodEn || 'month',
        billingPeriodEs: billingPeriodEs || 'mes',
        featuresEn: featuresEn || [],
        featuresEs: featuresEs || [],
        isPopular: isPopular || false,
        isBestValue: isBestValue || false,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0
      }
    });

    // Invalidate cache
    subscriptionPricesCache = null;

    logger.info('Plan config updated', { planId, userId: req.user.id });

    res.json({
      success: true,
      data: { plan: config }
    });
  } catch (error) {
    logger.error('Error updating plan config:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PLAN_UPDATE_ERROR',
        message: 'Failed to update plan configuration'
      }
    });
  }
};

// Initialize default plan configs (Admin)
export const initializePlanConfigs = async (req, res) => {
  try {
    const defaultConfigs = [
      {
        id: 'WEEKLY',
        price: 2990,
        nameEn: 'Weekly Premium',
        nameEs: 'Premium Semanal',
        billingPeriodEn: 'week',
        billingPeriodEs: 'semana',
        featuresEn: [
          'Access to basic audio experiences',
          'Try before committing long-term',
          'Basic meditation content',
          '5% discount on purchases',
          'Email support'
        ],
        featuresEs: [
          'Acceso a experiencias de audio básicas',
          'Prueba antes de comprometerte a largo plazo',
          'Contenido básico de meditación',
          '5% de descuento en compras',
          'Soporte por email'
        ],
        isPopular: false,
        isBestValue: false,
        isActive: true,
        sortOrder: 1
      },
      {
        id: 'MONTHLY',
        price: 9990,
        nameEn: 'Monthly Premium',
        nameEs: 'Premium Mensual',
        billingPeriodEn: 'month',
        billingPeriodEs: 'mes',
        featuresEn: [
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
        ],
        isPopular: true,
        isBestValue: false,
        isActive: true,
        sortOrder: 2
      },
      {
        id: 'QUARTERLY',
        price: 25990,
        nameEn: 'Quarterly Premium',
        nameEs: 'Premium Trimestral',
        billingPeriodEn: '3 months',
        billingPeriodEs: '3 meses',
        featuresEn: [
          'All Monthly Premium features',
          'Save 28% compared to weekly',
          'Exclusive quarterly curated playlists',
          'Free shipping on all orders',
          'Birthday gift - special candle',
          'Personalized scent consultation'
        ],
        featuresEs: [
          'Todas las características del Premium Mensual',
          'Ahorra 28% comparado con semanal',
          'Listas de reproducción exclusivas trimestrales',
          'Envío gratis en todos los pedidos',
          'Regalo de cumpleaños - vela especial',
          'Consulta de fragancias personalizada'
        ],
        isPopular: false,
        isBestValue: true,
        isActive: true,
        sortOrder: 3
      }
    ];

    // Upsert all default configs
    for (const config of defaultConfigs) {
      await prisma.subscriptionPlanConfig.upsert({
        where: { id: config.id },
        update: config,
        create: config
      });
    }

    // Invalidate cache
    subscriptionPricesCache = null;

    logger.info('Plan configs initialized', { userId: req.user.id });

    res.json({
      success: true,
      data: { message: 'Plan configurations initialized successfully' }
    });
  } catch (error) {
    logger.error('Error initializing plan configs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PLANS_INIT_ERROR',
        message: 'Failed to initialize plan configurations'
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
    if (!['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(planId)) {
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

// Initialize Flow payment for subscription
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
      },
      include: {
        user: true
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

    logger.info('Initializing Flow payment for subscription', {
      subscriptionId,
      amount,
      email: subscription.user.email
    });

    // Create Flow payment
    const flowResponse = await createFlowPayment({
      commerceOrder: `SUB-${subscription.id.substring(0, 20)}`,
      subject: `Suscripción ${subscription.planId}`,
      amount,
      email: subscription.user.email,
      urlConfirmation: FLOW_CONFIG.urls.subscriptionConfirm,
      urlReturn: FLOW_CONFIG.urls.subscriptionReturn
    });

    // Store Flow token in subscription
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        webpayToken: flowResponse.token
      }
    });

    logger.info('Flow payment created for subscription', {
      subscriptionId,
      token: flowResponse.token,
      url: flowResponse.url
    });

    res.json({
      success: true,
      data: {
        token: flowResponse.token,
        url: `${flowResponse.url}?token=${flowResponse.token}`,
        subscriptionId: subscription.id
      }
    });
  } catch (error) {
    logger.error('Error initializing subscription payment:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'FLOW_INIT_ERROR',
        message: 'Failed to initialize payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
};

// Handle Flow confirmation callback for subscription (server-to-server)
export const handleSubscriptionFlowConfirm = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      logger.error('No token in subscription Flow confirm callback');
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    logger.info('Subscription Flow confirm callback received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);
    logger.info('Flow payment status for subscription', { flowStatus });

    // Find subscription by Flow token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for Flow token', { token });
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Check if transaction was approved
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    if (isApproved) {
      // Calculate expiry date based on plan
      const startDate = new Date();
      const expiryDate = new Date(startDate);

      switch (subscription.planId) {
        case 'WEEKLY':
          expiryDate.setDate(expiryDate.getDate() + 7);
          break;
        case 'MONTHLY':
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
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
          webpayTransactionId: flowStatus.flowOrder?.toString() || null
        }
      });

      logger.info('Subscription payment approved and activated', {
        subscriptionId: subscription.id,
        flowOrder: flowStatus.flowOrder,
        amount: flowStatus.amount
      });
    } else {
      // Payment failed
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'FAILED',
          webpayTransactionId: flowStatus.flowOrder?.toString() || null
        }
      });

      logger.warn('Subscription payment rejected', {
        subscriptionId: subscription.id,
        status: flowStatus.status
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing subscription Flow confirm:', error);
    res.status(500).json({ success: false, error: 'Processing error' });
  }
};

// Handle Flow return callback for subscription (user redirect)
export const handleSubscriptionFlowReturn = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      logger.error('No token in subscription Flow return');
      return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error&message=missing_token`);
    }

    logger.info('Subscription Flow return received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);

    // Find subscription by Flow token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for Flow token', { token });
      return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error&message=subscription_not_found`);
    }

    // Check if transaction was approved
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    if (isApproved) {
      const successUrl = `${FLOW_CONFIG.urls.frontendSubscriptionResult}?subscriptionId=${subscription.id}&status=success`;
      return res.redirect(successUrl);
    } else {
      const failedUrl = `${FLOW_CONFIG.urls.frontendSubscriptionResult}?subscriptionId=${subscription.id}&status=failed`;
      return res.redirect(failedUrl);
    }
  } catch (error) {
    logger.error('Error processing subscription Flow return:', error);
    return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error`);
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
    if (newPlanId && ['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(newPlanId)) {
      updateData.planId = newPlanId;

      // Recalculate next renewal based on new plan
      const currentDate = new Date();
      const newExpiryDate = new Date(currentDate);

      switch (newPlanId) {
        case 'WEEKLY':
          newExpiryDate.setDate(newExpiryDate.getDate() + 7);
          break;
        case 'MONTHLY':
          newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
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
      weeklyCount,
      monthlyCount,
      quarterlyCount,
      recentSubscriptions
    ] = await Promise.all([
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'CANCELLED' } }),
      prisma.subscription.count({ where: { status: 'PAUSED' } }),
      prisma.subscription.count({ where: { status: 'EXPIRED' } }),
      prisma.subscription.count({ where: { planId: 'WEEKLY', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { planId: 'MONTHLY', status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { planId: 'QUARTERLY', status: 'ACTIVE' } }),
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
    // Weekly: multiply by ~4.33 (avg weeks per month)
    const weeklyMRR = weeklyCount * (SUBSCRIPTION_PRICES.WEEKLY * 4.33);
    const monthlyMRR = monthlyCount * SUBSCRIPTION_PRICES.MONTHLY;
    const quarterlyMRR = quarterlyCount * (SUBSCRIPTION_PRICES.QUARTERLY / 3);
    const totalMRR = weeklyMRR + monthlyMRR + quarterlyMRR;

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
          weekly: weeklyCount,
          monthly: monthlyCount,
          quarterly: quarterlyCount
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
    if (!['WEEKLY', 'MONTHLY', 'QUARTERLY'].includes(newPlanId)) {
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
    const planHierarchy = { WEEKLY: 1, MONTHLY: 2, QUARTERLY: 3 };
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

// Initialize Flow payment for subscription upgrade
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
      },
      include: {
        user: true
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

    logger.info('Initializing Flow payment for subscription upgrade', {
      subscriptionId,
      newPlanId,
      amount,
      email: subscription.user.email
    });

    // Create Flow payment for upgrade
    // Include newPlanId in commerceOrder for later retrieval
    const flowResponse = await createFlowPayment({
      commerceOrder: `UPG-${subscription.id.substring(0, 15)}-${newPlanId}`,
      subject: `Upgrade a ${newPlanId}`,
      amount,
      email: subscription.user.email,
      urlConfirmation: FLOW_CONFIG.urls.upgradeConfirm,
      urlReturn: FLOW_CONFIG.urls.upgradeReturn
    });

    // Store upgrade info temporarily
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        webpayToken: flowResponse.token
      }
    });

    logger.info('Flow payment created for subscription upgrade', {
      subscriptionId,
      newPlanId,
      token: flowResponse.token,
      url: flowResponse.url
    });

    res.json({
      success: true,
      data: {
        token: flowResponse.token,
        url: `${flowResponse.url}?token=${flowResponse.token}`,
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
        code: 'FLOW_INIT_ERROR',
        message: 'Failed to initialize upgrade payment',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    });
  }
};

// Handle Flow confirmation callback for subscription upgrade (server-to-server)
export const handleUpgradeFlowConfirm = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      logger.error('No token in upgrade Flow confirm callback');
      return res.status(400).json({ success: false, error: 'Missing token' });
    }

    logger.info('Upgrade Flow confirm callback received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);
    logger.info('Flow payment status for upgrade', { flowStatus });

    // Find subscription by Flow token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for upgrade Flow token', { token });
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Check if transaction was approved
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    if (isApproved) {
      // Extract new plan from commerceOrder (format: UPG-{subscriptionId}-{newPlanId})
      const commerceOrder = flowStatus.commerceOrder || '';
      const orderParts = commerceOrder.split('-');
      const newPlanId = orderParts[orderParts.length - 1] || 'QUARTERLY';

      // Calculate new expiry date based on new plan
      const startDate = new Date();
      const expiryDate = new Date(startDate);

      switch (newPlanId) {
        case 'WEEKLY':
          expiryDate.setDate(expiryDate.getDate() + 7);
          break;
        case 'MONTHLY':
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          expiryDate.setMonth(expiryDate.getMonth() + 3);
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
          webpayTransactionId: flowStatus.flowOrder?.toString() || null
        }
      });

      logger.info('Subscription upgrade payment approved and applied', {
        subscriptionId: subscription.id,
        newPlanId,
        flowOrder: flowStatus.flowOrder,
        amount: flowStatus.amount
      });
    } else {
      // Payment failed - keep subscription as is
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          webpayToken: null // Clear the token
        }
      });

      logger.warn('Subscription upgrade payment rejected', {
        subscriptionId: subscription.id,
        status: flowStatus.status
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing upgrade Flow confirm:', error);
    res.status(500).json({ success: false, error: 'Processing error' });
  }
};

// Handle Flow return callback for subscription upgrade (user redirect)
export const handleUpgradeFlowReturn = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      logger.error('No token in upgrade Flow return');
      return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error&message=missing_token`);
    }

    logger.info('Upgrade Flow return received', { token });

    // Get payment status from Flow
    const flowStatus = await getFlowPaymentStatus(token);

    // Find subscription by Flow token
    const subscription = await prisma.subscription.findFirst({
      where: { webpayToken: token }
    });

    if (!subscription) {
      logger.error('Subscription not found for upgrade Flow token', { token });
      return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error&message=subscription_not_found`);
    }

    // Check if transaction was approved
    const isApproved = flowStatus.status === FLOW_STATUS.PAID;

    if (isApproved) {
      // Extract new plan from commerceOrder
      const commerceOrder = flowStatus.commerceOrder || '';
      const orderParts = commerceOrder.split('-');
      const newPlanId = orderParts[orderParts.length - 1] || 'QUARTERLY';

      const successUrl = `${FLOW_CONFIG.urls.frontendSubscriptionResult}?subscriptionId=${subscription.id}&status=upgraded&plan=${newPlanId}`;
      return res.redirect(successUrl);
    } else {
      const failedUrl = `${FLOW_CONFIG.urls.frontendSubscriptionResult}?subscriptionId=${subscription.id}&status=upgrade_failed`;
      return res.redirect(failedUrl);
    }
  } catch (error) {
    logger.error('Error processing upgrade Flow return:', error);
    return res.redirect(`${FLOW_CONFIG.urls.frontendSubscriptionResult}?status=error`);
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
          case 'WEEKLY':
            newExpiryDate.setDate(newExpiryDate.getDate() + 7);
            break;
          case 'MONTHLY':
            newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
            break;
          case 'QUARTERLY':
            newExpiryDate.setMonth(newExpiryDate.getMonth() + 3);
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
