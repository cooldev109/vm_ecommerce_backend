import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const bcrypt = await import('bcrypt');
  const adminPasswordHash = await bcrypt.hash('Admin123!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vmcandles.com' },
    update: {},
    create: {
      email: 'admin@vmcandles.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      profile: {
        create: {
          firstName: 'Admin',
          lastName: 'V&M',
          phone: '+56912345678',
          customerType: 'INDIVIDUAL',
        },
      },
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create test user
  const testPasswordHash = await bcrypt.hash('Test123!', 12);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: testPasswordHash,
      role: 'USER',
      profile: {
        create: {
          firstName: 'Test',
          lastName: 'User',
          phone: '+56987654321',
          customerType: 'INDIVIDUAL',
          taxId: '12345678-9',
        },
      },
    },
  });

  console.log('✅ Test user created:', testUser.email);

  // Create additional test users for populated admin panel
  const additionalUsers = [
    {
      email: 'john.doe@example.com',
      password: 'User123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+56912345001',
      customerType: 'INDIVIDUAL',
    },
    {
      email: 'maria.garcia@example.com',
      password: 'User123!',
      firstName: 'María',
      lastName: 'García',
      phone: '+56912345002',
      customerType: 'INDIVIDUAL',
      taxId: '98765432-1',
    },
    {
      email: 'carlos.silva@example.com',
      password: 'User123!',
      firstName: 'Carlos',
      lastName: 'Silva',
      phone: '+56912345003',
      customerType: 'BUSINESS',
      taxId: '76543210-K',
    },
    {
      email: 'ana.martinez@example.com',
      password: 'User123!',
      firstName: 'Ana',
      lastName: 'Martínez',
      phone: '+56912345004',
      customerType: 'INDIVIDUAL',
    },
  ];

  for (const userData of additionalUsers) {
    const userPasswordHash = await bcrypt.hash(userData.password, 12);
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash: userPasswordHash,
        role: 'USER',
        profile: {
          create: {
            firstName: userData.firstName,
            lastName: userData.lastName,
            phone: userData.phone,
            customerType: userData.customerType,
            taxId: userData.taxId || null,
          },
        },
      },
    });
  }

  console.log(`✅ Created ${additionalUsers.length} additional test users`);

  // Clear existing products and related data for clean seeding
  await prisma.cartItem.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.productTranslation.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('🗑️  Cleared existing products and all related data');

  // Seed products (2 candles + 4 accessories)
  // Images reference assets folder paths (used via import in frontend)
  const products = [
    // Candles - Only 2 products as per client request
    { id: '1', category: 'CANDLES', price: 48.00, image: '/src/assets/candle-product.png', burnTime: '50-60 hours', size: '250g' },
    { id: '2', category: 'CANDLES', price: 52.00, image: '/src/assets/executive_balance.png', burnTime: '55-65 hours', size: '250g' },
    // Accessories
    { id: 'acc-1', category: 'ACCESSORIES', price: 25.00, image: '/src/assets/accessory-snuffer.jpg', burnTime: null, size: null },
    { id: 'acc-2', category: 'ACCESSORIES', price: 28.00, image: '/src/assets/accessory-trimmer.jpg', burnTime: null, size: null },
    { id: 'acc-3', category: 'ACCESSORIES', price: 22.00, image: '/src/assets/accessory-dipper.jpg', burnTime: null, size: null },
    { id: 'acc-4', category: 'SETS', price: 69.00, image: '/src/assets/accessory-set.jpg', burnTime: null, size: null },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: {
        ...product,
        images: [product.image],
        inStock: true,
        featured: ['1', '2'].includes(product.id),
        sortOrder: parseInt(product.id.replace(/[^0-9]/g, '')) || 100,
      },
    });
  }

  console.log(`✅ Created ${products.length} products`);

  // Seed product translations (Spanish and English)
  const translations = {
    '1': {
      ES: { name: 'V&M Ritual de Calma', desc: 'Una lujosa vela de vainilla cremosa para confort cálido y tranquilidad suave', features: ['Calma Profunda & Armonía Interior', 'Confort Sensorial & Calidez Afectiva', 'Cera vegetal 100% natural', 'Aceites esenciales puros'] },
      EN: { name: 'V&M Calm Ritual', desc: 'A luxurious creamy vanilla candle for warm comfort and gentle tranquility', features: ['Deep Calm & Inner Harmony', 'Sensory Comfort & Emotional Warmth', '100% natural plant wax', 'Pure essential oils'] }
    },
    '2': {
      ES: { name: 'V&M Balance Ejecutivo', desc: 'Una vela premium diseñada para espacios profesionales, combinando bergamota revitalizante con cedro terroso para claridad mental y enfoque productivo', features: ['Claridad Mental & Enfoque Estratégico', 'Balance Profesional & Estabilidad Emocional', 'Ideal para oficinas y espacios de trabajo', 'Fragancia sofisticada y discreta'] },
      EN: { name: 'V&M Executive Balance', desc: 'A premium candle designed for professional spaces, combining revitalizing bergamot with earthy cedar for mental clarity and productive focus', features: ['Mental Clarity & Strategic Focus', 'Professional Balance & Emotional Stability', 'Ideal for offices and workspaces', 'Sophisticated and discrete fragrance'] }
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
      EN: { name: 'Wick Dipper', desc: 'Wick dipper that submerges the flame in wax to avoid smoke and preserve aroma', features: ['Resistant steel', 'Smoke-free', 'Preserves aroma', 'Easy to use'] }
    },
    'acc-4': {
      ES: { name: 'Set Completo de Accesorios Premium', desc: 'Set completo de accesorios para el cuidado profesional de tus velas, incluye apagavelas, cortamechas, apagador sumergible y bandeja dorada', features: ['3 herramientas profesionales', 'Bandeja organizadora dorada', 'Acabado premium', 'Cuidado completo de velas'] },
      EN: { name: 'Complete Premium Accessories Set', desc: 'Complete accessory set for professional candle care, includes snuffer, wick trimmer, wick dipper and gold tray', features: ['3 professional tools', 'Gold organizer tray', 'Premium finish', 'Complete candle care'] }
    },
  };

  for (const [productId, languages] of Object.entries(translations)) {
    for (const [lang, trans] of Object.entries(languages)) {
      await prisma.productTranslation.upsert({
        where: {
          productId_language: {
            productId,
            language: lang,
          },
        },
        update: {
          name: trans.name,
          description: trans.desc,
          longDescription: lang === 'ES'
            ? 'En V&M creamos velas artesanales de alta gama, formuladas con ceras vegetales, aceites esenciales puros y fragancias de grado perfumista que elevan los sentidos.'
            : 'At V&M we create high-end artisanal candles, formulated with plant waxes, pure essential oils and perfume-grade fragrances that elevate the senses.',
          features: trans.features,
        },
        create: {
          productId,
          language: lang,
          name: trans.name,
          description: trans.desc,
          longDescription: lang === 'ES'
            ? 'En V&M creamos velas artesanales de alta gama, formuladas con ceras vegetales, aceites esenciales puros y fragancias de grado perfumista que elevan los sentidos.'
            : 'At V&M we create high-end artisanal candles, formulated with plant waxes, pure essential oils and perfume-grade fragrances that elevate the senses.',
          features: trans.features,
        },
      });
    }
  }

  console.log('✅ Created product translations (Spanish & English)');

  // Clear existing audio content for clean seeding
  await prisma.audioContent.deleteMany({});
  await prisma.audioAccessKey.deleteMany({});

  // Seed comprehensive audio content library
  const audioContent = [
    // Preview tracks (free for everyone)
    { titleKey: 'deepCalm', category: 'MEDITATION', durationSeconds: 600, isPreview: true, requiredPlan: null },
    { titleKey: 'spiritualConnection', category: 'AMBIENT', durationSeconds: 720, isPreview: true, requiredPlan: null },
    { titleKey: 'emotionalBalance', category: 'MEDITATION', durationSeconds: 540, isPreview: true, requiredPlan: null },

    // Monthly plan content (AMBIENT & MEDITATION)
    { titleKey: 'morningSerenity', category: 'AMBIENT', durationSeconds: 1800, isPreview: false, requiredPlan: null },
    { titleKey: 'eveningRelaxation', category: 'AMBIENT', durationSeconds: 2400, isPreview: false, requiredPlan: null },
    { titleKey: 'forestRain', category: 'AMBIENT', durationSeconds: 3600, isPreview: false, requiredPlan: null },
    { titleKey: 'oceanWaves', category: 'AMBIENT', durationSeconds: 3600, isPreview: false, requiredPlan: null },
    { titleKey: 'guidedBreathing', category: 'MEDITATION', durationSeconds: 900, isPreview: false, requiredPlan: null },
    { titleKey: 'bodyRelaxation', category: 'MEDITATION', durationSeconds: 1200, isPreview: false, requiredPlan: null },
    { titleKey: 'innerPeace', category: 'MEDITATION', durationSeconds: 1500, isPreview: false, requiredPlan: null },
    { titleKey: 'sleepMeditation', category: 'MEDITATION', durationSeconds: 1800, isPreview: false, requiredPlan: null },

    // Quarterly plan content (MEDITATION tracks with healing themes)
    { titleKey: 'healingFrequency432', category: 'MEDITATION', durationSeconds: 2400, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'chakraBalance', category: 'MEDITATION', durationSeconds: 2700, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'tibetanBowls', category: 'AMBIENT', durationSeconds: 3000, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'binauralBeats', category: 'AMBIENT', durationSeconds: 3600, isPreview: false, requiredPlan: 'QUARTERLY' },

    // Annual plan exclusive content (premium AMBIENT and MEDITATION)
    { titleKey: 'exclusiveMasterclass', category: 'MEDITATION', durationSeconds: 5400, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'premiumRetreat', category: 'MEDITATION', durationSeconds: 7200, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'seasonalCollection', category: 'AMBIENT', durationSeconds: 4800, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'liveSessionRecording', category: 'MEDITATION', durationSeconds: 5400, isPreview: false, requiredPlan: 'ANNUAL' },
  ];

  for (let i = 0; i < audioContent.length; i++) {
    const audio = audioContent[i];
    await prisma.audioContent.create({
      data: {
        titleKey: audio.titleKey,
        category: audio.category,
        durationSeconds: audio.durationSeconds,
        isPreview: audio.isPreview,
        requiredPlan: audio.requiredPlan,
        fileUrl: `/audio/${audio.titleKey}.mp3`,
        sortOrder: i,
      },
    });
  }

  console.log(`✅ Created ${audioContent.length} audio content tracks`);

  // Create sample access keys
  const accessKeys = [
    { keyCode: 'VM-DEMO1-MONTH', planId: 'MONTHLY', durationMonths: 1 },
    { keyCode: 'VM-DEMO3-QUART', planId: 'QUARTERLY', durationMonths: 3 },
    { keyCode: 'VM-DEMO12-YEAR', planId: 'ANNUAL', durationMonths: 12 },
    { keyCode: 'VM-PROMO-GIFT1', planId: 'MONTHLY', durationMonths: 1 },
    { keyCode: 'VM-PROMO-GIFT2', planId: 'QUARTERLY', durationMonths: 3 },
  ];

  for (const key of accessKeys) {
    await prisma.audioAccessKey.create({
      data: key,
    });
  }

  console.log(`✅ Created ${accessKeys.length} sample access keys`);

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
