import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './config/logger.js';
import { autoSeedIfNeeded } from './utils/autoSeed.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import productsRouter from './routes/products.js';
import cartRouter from './routes/cart.js';
import ordersRouter from './routes/orders.js';
import paymentsRouter from './routes/payments.js';
import invoicesRouter from './routes/invoices.js';
import uploadRouter from './routes/upload.js';
import usersRouter from './routes/users.js';
import subscriptionsRouter from './routes/subscriptions.js';
import audioRouter from './routes/audio.js';
import reviewsRouter from './routes/reviews.js';
import analyticsRouter from './routes/analytics.js';
import wishlistRouter from './routes/wishlist.js';
import inventoryRouter from './routes/inventory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy when behind Nginx (required for rate-limiting and getting real IP)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (direct browser access, Postman, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // In development, allow any localhost port
    if (process.env.NODE_ENV !== 'production') {
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        callback(null, true);
        return;
      }
    }

    // In production, only allow configured origin
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
    if (origin === allowedOrigin) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Static file serving for audio files
app.use('/audio', express.static(path.join(__dirname, '../uploads/audio')));

// Rate limiting (more lenient in development)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Dev: 1000, Prod: 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health'
});

app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/audio', audioRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin/analytics', analyticsRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/admin/inventory', inventoryRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'V&M Candle Experience API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred'
        : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// Auto-seed database if empty (production deployment helper)
async function startServer() {
  // Check and seed database if needed
  await autoSeedIfNeeded();

  // Start server
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    logger.info(`✅ Health check: http://localhost:${PORT}/api/health`);
  });
}

// Initialize server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
// trigger restart 2
