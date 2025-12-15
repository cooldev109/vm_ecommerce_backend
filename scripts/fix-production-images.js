/**
 * Script to fix production database image paths
 * Run this with: node scripts/fix-production-images.js
 *
 * Make sure to set the production DATABASE_URL before running:
 * DATABASE_URL="postgresql://..." node scripts/fix-production-images.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const imageMapping = {
  '1': '/src/assets/product-vanilla-candle.jpg',
  '2': '/src/assets/product-lavender-candle.jpg',
  '3': '/src/assets/product-eucalyptus-candle.jpg',
  '4': '/src/assets/product-rose-candle.jpg',
  '5': '/src/assets/product-citrus-candle.jpg',
  '6': '/src/assets/product-sandalwood-candle.jpg',
  '7': '/src/assets/product-cedarwood-candle.jpg',
  '8': '/src/assets/product-bergamot-candle.jpg',
  '9': '/src/assets/product-peony-candle.jpg',
  '10': '/src/assets/product-amber-candle.jpg',
  '15': '/src/assets/product-jasmine-candle.jpg',
  '17': '/src/assets/V&M Calm  Ritual.jpg',
  '18': '/src/assets/product-rose-candle.jpg',
  'acc-1': '/src/assets/accessory-snuffer.jpg',
  'acc-2': '/src/assets/accessory-trimmer.jpg',
  'acc-3': '/src/assets/accessory-dipper.jpg',
};

async function fixProductImages() {
  console.log('🔧 Starting image path fix...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const [productId, imagePath] of Object.entries(imageMapping)) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, image: true }
      });

      if (!product) {
        console.log(`⚠️  Product ${productId} not found - skipping`);
        continue;
      }

      console.log(`📝 Updating ${productId}: ${product.name}`);
      console.log(`   Old: ${product.image}`);
      console.log(`   New: ${imagePath}`);

      await prisma.product.update({
        where: { id: productId },
        data: {
          image: imagePath,
          images: [imagePath]
        }
      });

      console.log(`✅ Updated successfully\n`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${productId}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully updated: ${successCount} products`);
  console.log(`❌ Errors: ${errorCount} products`);
  console.log('='.repeat(50));
}

async function main() {
  try {
    await fixProductImages();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
