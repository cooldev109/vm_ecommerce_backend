import { PrismaClient } from './src/generated/prisma/index.js';
import logger from './src/config/logger.js';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testConnection() {
  try {
    logger.info('🔍 Testing database connection...');

    // Test connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');

    // Test queries
    const userCount = await prisma.user.count();
    logger.info(`📊 Users in database: ${userCount}`);

    const productCount = await prisma.product.count();
    logger.info(`📦 Products in database: ${productCount}`);

    const orderCount = await prisma.order.count();
    logger.info(`🛒 Orders in database: ${orderCount}`);

    // Test a complex query
    const productsWithTranslations = await prisma.product.findMany({
      include: {
        translations: true,
      },
      take: 3,
    });
    logger.info(`🌍 Sample products with translations: ${productsWithTranslations.length}`);

    logger.info('✅ All database tests passed!');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testConnection();
