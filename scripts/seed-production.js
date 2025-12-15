/**
 * Re-seed production database to fix image paths
 * Run: DATABASE_URL="your-prod-url" node scripts/seed-production.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting production database seed...\n');

  // Check if this is actually a production database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set!');
    console.log('Run: DATABASE_URL="postgresql://..." node scripts/seed-production.js');
    process.exit(1);
  }

  if (databaseUrl.includes('localhost')) {
    console.error('⚠️  Warning: DATABASE_URL points to localhost!');
    console.log('This script is for production. Use npm run db:seed for local.');
    process.exit(1);
  }

  console.log('📊 Database:', databaseUrl.replace(/:\/\/.*@/, '://***@'));
  console.log('');

  // Define products with correct image paths
  const products = [
    { id: '1', category: 'CANDLES', price: 58.00, image: '/src/assets/product-vanilla-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '2', category: 'CANDLES', price: 56.00, image: '/src/assets/product-lavender-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '3', category: 'CANDLES', price: 54.00, image: '/src/assets/product-eucalyptus-candle.jpg', burnTime: '45-55 hours', size: '220g' },
    { id: '4', category: 'CANDLES', price: 60.00, image: '/src/assets/product-rose-candle.jpg', burnTime: '60-70 hours', size: '280g' },
    { id: '5', category: 'CANDLES', price: 55.00, image: '/src/assets/product-citrus-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '6', category: 'CANDLES', price: 62.00, image: '/src/assets/product-sandalwood-candle.jpg', burnTime: '65-75 hours', size: '300g' },
    { id: '7', category: 'CANDLES', price: 59.00, image: '/src/assets/product-cedarwood-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '8', category: 'CANDLES', price: 57.00, image: '/src/assets/product-bergamot-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '9', category: 'CANDLES', price: 58.00, image: '/src/assets/product-peony-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '10', category: 'CANDLES', price: 61.00, image: '/src/assets/product-amber-candle.jpg', burnTime: '60-70 hours', size: '280g' },
    { id: '15', category: 'CANDLES', price: 60.00, image: '/src/assets/product-jasmine-candle.jpg', burnTime: '60-70 hours', size: '280g' },
    { id: '17', category: 'CANDLES', price: 54.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '18', category: 'CANDLES', price: 59.00, image: '/src/assets/product-rose-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    // Accessories (THE ONES WITH BROKEN IMAGES!)
    { id: 'acc-1', category: 'ACCESSORIES', price: 25.00, image: '/src/assets/accessory-snuffer.jpg', burnTime: null, size: null },
    { id: 'acc-2', category: 'ACCESSORIES', price: 28.00, image: '/src/assets/accessory-trimmer.jpg', burnTime: null, size: null },
    { id: 'acc-3', category: 'ACCESSORIES', price: 22.00, image: '/src/assets/accessory-dipper.jpg', burnTime: null, size: null },
  ];

  const translations = {
    '1': {
      ES: { name: 'Vainilla Bourbon', desc: 'Vainilla cremosa y cálida con toques de caramelo y especias suaves', features: ['Vainilla premium', 'Cálida y acogedora', 'Larga duración', 'Cera natural'] },
      EN: { name: 'Bourbon Vanilla', desc: 'Creamy, warm vanilla with hints of caramel and soft spices', features: ['Premium vanilla', 'Warm and cozy', 'Long-lasting', 'Natural wax'] }
    },
    '2': {
      ES: { name: 'Lavanda Provenzal', desc: 'Lavanda fresca y herbal que calma la mente y relaja el espíritu', features: ['Lavanda francesa', 'Efecto calmante', 'Aroma herbal', 'Relajación profunda'] },
      EN: { name: 'Provencal Lavender', desc: 'Fresh, herbal lavender that calms the mind and relaxes the spirit', features: ['French lavender', 'Calming effect', 'Herbal aroma', 'Deep relaxation'] }
    },
    '3': {
      ES: { name: 'Eucalipto Vital', desc: 'Eucalipto refrescante con notas de menta que despeja y revitaliza', features: ['Eucalipto puro', 'Efecto refrescante', 'Despeja la mente', 'Revitalizante'] },
      EN: { name: 'Vital Eucalyptus', desc: 'Refreshing eucalyptus with mint notes that clears and revitalizes', features: ['Pure eucalyptus', 'Refreshing effect', 'Clears the mind', 'Revitalizing'] }
    },
    '4': {
      ES: { name: 'Rosa de Damasco', desc: 'Rosa delicada y romántica con toques florales y ligero dulzor', features: ['Rosa damascena', 'Fragancia floral', 'Elegancia natural', 'Dulzor sutil'] },
      EN: { name: 'Damascus Rose', desc: 'Delicate, romantic rose with floral notes and light sweetness', features: ['Rosa damascena', 'Floral fragrance', 'Natural elegance', 'Subtle sweetness'] }
    },
    '5': {
      ES: { name: 'Cítricos del Mediterráneo', desc: 'Mezcla energizante de naranja, limón y bergamota', features: ['Cítricos frescos', 'Energizante', 'Aroma brillante', 'Revitalizante'] },
      EN: { name: 'Mediterranean Citrus', desc: 'Energizing blend of orange, lemon and bergamot', features: ['Fresh citrus', 'Energizing', 'Bright aroma', 'Revitalizing'] }
    },
    '6': {
      ES: { name: 'Sándalo Místico', desc: 'Sándalo cálido y amaderado con notas terrosas y sensuales', features: ['Sándalo premium', 'Aroma amaderado', 'Cálido y sensual', 'Meditativo'] },
      EN: { name: 'Mystic Sandalwood', desc: 'Warm, woody sandalwood with earthy and sensual notes', features: ['Premium sandalwood', 'Woody aroma', 'Warm and sensual', 'Meditative'] }
    },
    '7': {
      ES: { name: 'Cedro del Atlas', desc: 'Cedro noble y amaderado que aporta fuerza y equilibrio', features: ['Cedro del Atlas', 'Amaderado noble', 'Fuerza y equilibrio', 'Masculino'] },
      EN: { name: 'Atlas Cedar', desc: 'Noble, woody cedar that brings strength and balance', features: ['Atlas cedar', 'Noble woody', 'Strength and balance', 'Masculine'] }
    },
    '8': {
      ES: { name: 'Bergamota Earl Grey', desc: 'Bergamota elegante con toques de té negro y flores', features: ['Bergamota italiana', 'Notas de té', 'Elegante y sofisticado', 'Cítrico floral'] },
      EN: { name: 'Earl Grey Bergamot', desc: 'Elegant bergamot with notes of black tea and flowers', features: ['Italian bergamot', 'Tea notes', 'Elegant and sophisticated', 'Floral citrus'] }
    },
    '9': {
      ES: { name: 'Peonía Jardín', desc: 'Peonía fresca y delicada con toques verdes y florales', features: ['Peonía fresca', 'Delicada y suave', 'Toques verdes', 'Primaveral'] },
      EN: { name: 'Garden Peony', desc: 'Fresh, delicate peony with green and floral touches', features: ['Fresh peony', 'Delicate and soft', 'Green touches', 'Spring-like'] }
    },
    '10': {
      ES: { name: 'Ámbar Sensual', desc: 'Ámbar cálido y envolvente con almizcle y vainilla', features: ['Ámbar premium', 'Cálido y sensual', 'Almizcle y vainilla', 'Sofisticado'] },
      EN: { name: 'Sensual Amber', desc: 'Warm, enveloping amber with musk and vanilla', features: ['Premium amber', 'Warm and sensual', 'Musk and vanilla', 'Sophisticated'] }
    },
    '15': {
      ES: { name: 'Jazmín Nocturno', desc: 'Jazmín intenso y seductor que florece en la noche', features: ['Jazmín nocturno', 'Intenso y floral', 'Seductor', 'Exótico'] },
      EN: { name: 'Night Jasmine', desc: 'Intense, seductive jasmine that blooms at night', features: ['Night jasmine', 'Intense and floral', 'Seductive', 'Exotic'] }
    },
    '17': {
      ES: { name: 'Calm Ritual', desc: 'Seis esencias que restauran tu alma', features: ['Mezcla de 6 esencias', 'Restaura el alma', 'Ritual de calma', 'Experiencia única'] },
      EN: { name: 'Calm Ritual', desc: 'Six essences that restore your soul', features: ['Blend of 6 essences', 'Restores the soul', 'Ritual of calm', 'Unique experience'] }
    },
    '18': {
      ES: { name: 'Harén del Sultán', desc: 'Jazmín nocturno, almizcle y ámbar crean una fragancia opulenta de seducción oriental', features: ['Jazmín nocturno', 'Almizcle y ámbar', 'Seducción oriental', 'Opulencia femenina'] },
      EN: { name: 'Sultan\'s Harem', desc: 'Night jasmine, musk and amber create an opulent fragrance of oriental seduction', features: ['Night jasmine', 'Musk and amber', 'Oriental seduction', 'Feminine opulence'] }
    },
    'acc-1': {
      ES: { name: 'Apagavelas Premium', desc: 'Apagavelas de acero inoxidable con acabado dorado para extinguir velas sin humo', features: ['Acero inoxidable', 'Acabado dorado', 'Sin humo', 'Diseño elegante'] },
      EN: { name: 'Premium Candle Snuffer', desc: 'Stainless steel candle snuffer with gold finish to extinguish candles smoke-free', features: ['Stainless steel', 'Gold finish', 'Smoke-free', 'Elegant design'] }
    },
    'acc-2': {
      ES: { name: 'Cortamechas de Lujo', desc: 'Tijeras especializadas para recortar mechas y mantener una llama perfecta', features: ['Acero quirúrgico', 'Corte preciso', 'Bandeja recolectora', 'Acabado premium'] },
      EN: { name: 'Luxury Wick Trimmer', desc: 'Specialized scissors to trim wicks and maintain a perfect flame', features: ['Surgical steel', 'Precise cut', 'Collection tray', 'Premium finish'] }
    },
    'acc-3': {
      ES: { name: 'Apagador Sumergible', desc: 'Apagador de mecha que sumerge la llama en la cera para evitar humo y conservar el aroma', features: ['Acero resistente', 'Sin humo', 'Conserva el aroma', 'Fácil de usar'] },
      EN: { name: 'Wick Dipper', desc: 'Wick snuffer that submerges the flame in wax to avoid smoke and preserve aroma', features: ['Durable steel', 'Smoke-free', 'Preserves aroma', 'Easy to use'] }
    },
  };

  console.log('🔄 Updating products with correct image paths...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    try {
      const trans = translations[product.id];

      await prisma.product.upsert({
        where: { id: product.id },
        update: {
          ...product,
          images: [product.image],
          inStock: true,
          featured: ['1', '2', '3'].includes(product.id),
        },
        create: {
          ...product,
          images: [product.image],
          inStock: true,
          stock: 0,
          lowStockThreshold: 10,
          trackInventory: true,
          featured: ['1', '2', '3'].includes(product.id),
          translations: {
            create: [
              {
                language: 'ES',
                name: trans.ES.name,
                description: trans.ES.desc,
                longDescription: 'En V&M creamos velas artesanales de alta gama, formuladas con ceras vegetales, aceites esenciales puros y fragancias de grado perfumista que elevan los sentidos.',
                features: trans.ES.features,
              },
              {
                language: 'EN',
                name: trans.EN.name,
                description: trans.EN.desc,
                longDescription: 'At V&M we create high-end artisan candles, formulated with vegetable waxes, pure essential oils and perfume-grade fragrances that elevate the senses.',
                features: trans.EN.features,
              },
            ],
          },
        },
      });

      console.log(`✅ ${product.id}: ${trans.ES.name} → ${product.image}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error updating ${product.id}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully updated: ${successCount} products`);
  console.log(`❌ Errors: ${errorCount} products`);
  console.log('='.repeat(60));
  console.log('\n✨ Production database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
