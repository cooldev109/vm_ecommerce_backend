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

  // Seed products (11 candles + 3 accessories)
  // Images reference assets folder paths (used via import in frontend)
  const products = [
    // Candles
    { id: '1', category: 'CANDLES', price: 48.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '2', category: 'CANDLES', price: 45.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '3', category: 'CANDLES', price: 52.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '4', category: 'CANDLES', price: 50.00, image: '/src/assets/product-rose-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '5', category: 'CANDLES', price: 46.00, image: '/src/assets/product-citrus-candle.jpg', burnTime: '45-55 hours', size: '250g' },
    { id: '6', category: 'CANDLES', price: 47.00, image: '/src/assets/product-eucalyptus-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '7', category: 'CANDLES', price: 49.00, image: '/src/assets/product-jasmine-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '8', category: 'CANDLES', price: 51.00, image: '/src/assets/product-cedarwood-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '9', category: 'CANDLES', price: 54.00, image: '/src/assets/product-amber-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '10', category: 'CANDLES', price: 48.00, image: '/src/assets/product-bergamot-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '11', category: 'CANDLES', price: 50.00, image: '/src/assets/product-peony-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    // Oriental Female Fragrances - New Collection
    { id: '12', category: 'CANDLES', price: 56.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '13', category: 'CANDLES', price: 58.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '55-65 hours', size: '250g' },
    { id: '14', category: 'CANDLES', price: 55.00, image: '/src/assets/product-rose-candle.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '15', category: 'CANDLES', price: 60.00, image: '/src/assets/product-jasmine-candle.jpg', burnTime: '60-70 hours', size: '280g' },
    { id: '16', category: 'CANDLES', price: 62.00, image: '/src/assets/product-amber-candle.jpg', burnTime: '60-70 hours', size: '280g' },
    { id: '17', category: 'CANDLES', price: 54.00, image: '/src/assets/V&M Calm  Ritual.jpg', burnTime: '50-60 hours', size: '250g' },
    { id: '18', category: 'CANDLES', price: 59.00, image: '/src/assets/product-rose-candle.jpg', burnTime: '55-65 hours', size: '250g' },
    // Accessories
    { id: 'acc-1', category: 'ACCESSORIES', price: 25.00, image: '/src/assets/accessory-snuffer.jpg', burnTime: null, size: null },
    { id: 'acc-2', category: 'ACCESSORIES', price: 28.00, image: '/src/assets/accessory-trimmer.jpg', burnTime: null, size: null },
    { id: 'acc-3', category: 'ACCESSORIES', price: 22.00, image: '/src/assets/accessory-dipper.jpg', burnTime: null, size: null },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        ...product,
        images: [product.image],
        inStock: true,
        featured: ['1', '2', '3'].includes(product.id),
        sortOrder: parseInt(product.id.replace(/[^0-9]/g, '')) || 100,
      },
      create: {
        ...product,
        images: [product.image],
        inStock: true,
        featured: ['1', '2', '3'].includes(product.id),
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
      ES: { name: 'Sueños de Lavanda', desc: 'Lavanda francesa calmante mezclada con notas florales delicadas para relajación profunda', features: ['Relajación Emocional & Contención Suave', 'Calma profunda', 'Lavanda francesa premium', 'Hecho a mano'] },
      EN: { name: 'Lavender Dreams', desc: 'Soothing French lavender blended with delicate floral notes for deep relaxation', features: ['Emotional Relaxation & Gentle Containment', 'Deep calm', 'Premium French lavender', 'Handmade'] }
    },
    '3': {
      ES: { name: 'Místico Sándalo', desc: 'Sándalo rico y terroso con notas amaderadas cálidas para enraizamiento y meditación', features: ['Conexión Espiritual & Presencia Plena', 'Fortaleza Interior & Estabilidad Energética', 'Sándalo auténtico', 'Perfecto para meditación'] },
      EN: { name: 'Sandalwood Mystique', desc: 'Rich, earthy sandalwood with warm woody notes for grounding and meditation', features: ['Spiritual Connection & Full Presence', 'Inner Strength & Energy Stability', 'Authentic sandalwood', 'Perfect for meditation'] }
    },
    '4': {
      ES: { name: 'Jardín de Rosas', desc: 'Pétalos de rosa elegantes con un toque de jazmín para un ambiente romántico y refinado', features: ['Elevación del Ánimo & Bienestar Emocional', 'Aroma floral sofisticado', 'Rosa damascena', 'Ambiente romántico'] },
      EN: { name: 'Rose Garden', desc: 'Elegant rose petals with a touch of jasmine for a romantic and refined atmosphere', features: ['Mood Elevation & Emotional Well-being', 'Sophisticated floral aroma', 'Damascena rose', 'Romantic atmosphere'] }
    },
    '5': {
      ES: { name: 'Dicha Cítrica', desc: 'Mezcla vibrante de naranja, limón y pomelo para energía refrescante', features: ['Energizante natural', 'Cítricos frescos', 'Efecto revitalizante', 'Aroma vivificante'] },
      EN: { name: 'Citrus Bliss', desc: 'Vibrant blend of orange, lemon and grapefruit for refreshing energy', features: ['Natural energizer', 'Fresh citrus', 'Revitalizing effect', 'Invigorating aroma'] }
    },
    '6': {
      ES: { name: 'Eucalipto Menta', desc: 'Eucalipto fresco con menta para claridad mental y revitalización de los sentidos', features: ['Claridad mental', 'Efecto refrescante', 'Eucalipto australiano', 'Menta pura'] },
      EN: { name: 'Eucalyptus Mint', desc: 'Fresh eucalyptus with mint for mental clarity and sense revitalization', features: ['Mental clarity', 'Refreshing effect', 'Australian eucalyptus', 'Pure mint'] }
    },
    '7': {
      ES: { name: 'Jazmín Nocturno', desc: 'Jazmín exótico con notas verdes sutiles para equilibrio emocional y sensualidad', features: ['Equilibrio emocional', 'Aroma sensual', 'Jazmín sambac', 'Noches de verano'] },
      EN: { name: 'Night Jasmine', desc: 'Exotic jasmine with subtle green notes for emotional balance and sensuality', features: ['Emotional balance', 'Sensual aroma', 'Sambac jasmine', 'Summer nights'] }
    },
    '8': {
      ES: { name: 'Cedro Majestuoso', desc: 'Cedro terroso con toques amaderados ahumados para fuerza y estabilidad', features: ['Fortaleza interior', 'Notas amaderadas', 'Cedro del Atlas', 'Conexión con naturaleza'] },
      EN: { name: 'Majestic Cedarwood', desc: 'Earthy cedar with smoky woody touches for strength and stability', features: ['Inner strength', 'Woody notes', 'Atlas cedar', 'Nature connection'] }
    },
    '9': {
      ES: { name: 'Ámbar Dorado', desc: 'Ámbar cálido con vainilla y almizcle para lujo sensual y reconfortante', features: ['Lujo sensorial', 'Calidez reconfortante', 'Ámbar premium', 'Sofisticación'] },
      EN: { name: 'Golden Amber', desc: 'Warm amber with vanilla and musk for sensual and comforting luxury', features: ['Sensory luxury', 'Comforting warmth', 'Premium amber', 'Sophistication'] }
    },
    '10': {
      ES: { name: 'Bergamota Brillante', desc: 'Bergamota efervescente con té earl grey para elevación del ánimo y claridad', features: ['Elevación del ánimo', 'Claridad mental', 'Bergamota italiana', 'Té Earl Grey'] },
      EN: { name: 'Bright Bergamot', desc: 'Effervescent bergamot with earl grey tea for mood elevation and clarity', features: ['Mood elevation', 'Mental clarity', 'Italian bergamot', 'Earl Grey tea'] }
    },
    '11': {
      ES: { name: 'Peonía Elegante', desc: 'Peonía delicada con rosa y fresia para feminidad suave y elegante', features: ['Elegancia floral', 'Aroma delicado', 'Peonía francesa', 'Refinamiento'] },
      EN: { name: 'Elegant Peony', desc: 'Delicate peony with rose and freesia for soft and elegant femininity', features: ['Floral elegance', 'Delicate aroma', 'French peony', 'Refinement'] }
    },
    // Oriental Female Fragrances - New Collection
    '12': {
      ES: { name: 'Rosa de Oud', desc: 'Exquisita fusión de oud árabe con pétalos de rosa de Damasco para una feminidad misteriosa y seductora', features: ['Oud árabe auténtico', 'Rosa de Damasco', 'Feminidad oriental', 'Misterio sensual'] },
      EN: { name: 'Oud Rose', desc: 'Exquisite fusion of Arabian oud with Damascus rose petals for mysterious and seductive femininity', features: ['Authentic Arabian oud', 'Damascus rose', 'Oriental femininity', 'Sensual mystery'] }
    },
    '13': {
      ES: { name: 'Orquídea Mística', desc: 'Orquídea exótica con especias orientales y almizcle blanco para una sensualidad envolvente', features: ['Orquídea exótica', 'Especias orientales', 'Almizcle blanco', 'Sensualidad envolvente'] },
      EN: { name: 'Mystic Orchid', desc: 'Exotic orchid with oriental spices and white musk for enveloping sensuality', features: ['Exotic orchid', 'Oriental spices', 'White musk', 'Enveloping sensuality'] }
    },
    '14': {
      ES: { name: 'Noches de Arabia', desc: 'Ámbar dorado, oud y azafrán crean una experiencia aromática de las mil y una noches', features: ['Ámbar dorado', 'Oud y azafrán', 'Inspiración árabe', 'Lujo oriental'] },
      EN: { name: 'Arabian Nights', desc: 'Golden amber, oud and saffron create an aromatic experience of the thousand and one nights', features: ['Golden amber', 'Oud and saffron', 'Arabian inspiration', 'Oriental luxury'] }
    },
    '15': {
      ES: { name: 'Delicias Turcas', desc: 'Rosa turca con miel y almendra para un aroma dulce, cálido y profundamente femenino', features: ['Rosa turca', 'Miel y almendra', 'Dulzura oriental', 'Calidez femenina'] },
      EN: { name: 'Turkish Delight', desc: 'Turkish rose with honey and almond for a sweet, warm and deeply feminine aroma', features: ['Turkish rose', 'Honey and almond', 'Oriental sweetness', 'Feminine warmth'] }
    },
    '16': {
      ES: { name: 'Jardín Persa', desc: 'Granada, rosa y azafrán evocan los jardines secretos del antiguo imperio persa', features: ['Granada persa', 'Rosa y azafrán', 'Jardines secretos', 'Elegancia milenaria'] },
      EN: { name: 'Persian Garden', desc: 'Pomegranate, rose and saffron evoke the secret gardens of the ancient Persian empire', features: ['Persian pomegranate', 'Rose and saffron', 'Secret gardens', 'Millennial elegance'] }
    },
    '17': {
      ES: { name: 'Ruta de la Seda', desc: 'Sándalo cremoso, vainilla y especias exóticas recrean la magia de la antigua ruta comercial', features: ['Sándalo cremoso', 'Vainilla oriental', 'Especias exóticas', 'Magia ancestral'] },
      EN: { name: 'Silk Road', desc: 'Creamy sandalwood, vanilla and exotic spices recreate the magic of the ancient trade route', features: ['Creamy sandalwood', 'Oriental vanilla', 'Exotic spices', 'Ancestral magic'] }
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
      EN: { name: 'Wick Dipper', desc: 'Wick dipper that submerges the flame in wax to avoid smoke and preserve aroma', features: ['Resistant steel', 'Smoke-free', 'Preserves aroma', 'Easy to use'] }
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
    { titleKey: 'emotionalBalance', category: 'FREQUENCY', durationSeconds: 540, isPreview: true, requiredPlan: null },

    // Monthly plan content (AMBIENT & MEDITATION)
    { titleKey: 'morningSerenity', category: 'AMBIENT', durationSeconds: 1800, isPreview: false, requiredPlan: null },
    { titleKey: 'eveningRelaxation', category: 'AMBIENT', durationSeconds: 2400, isPreview: false, requiredPlan: null },
    { titleKey: 'forestRain', category: 'AMBIENT', durationSeconds: 3600, isPreview: false, requiredPlan: null },
    { titleKey: 'oceanWaves', category: 'AMBIENT', durationSeconds: 3600, isPreview: false, requiredPlan: null },
    { titleKey: 'guidedBreathing', category: 'MEDITATION', durationSeconds: 900, isPreview: false, requiredPlan: null },
    { titleKey: 'bodyRelaxation', category: 'MEDITATION', durationSeconds: 1200, isPreview: false, requiredPlan: null },
    { titleKey: 'innerPeace', category: 'MEDITATION', durationSeconds: 1500, isPreview: false, requiredPlan: null },
    { titleKey: 'sleepMeditation', category: 'MEDITATION', durationSeconds: 1800, isPreview: false, requiredPlan: null },

    // Quarterly plan content (FREQUENCY)
    { titleKey: 'healingFrequency432', category: 'FREQUENCY', durationSeconds: 2400, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'chakraBalance', category: 'FREQUENCY', durationSeconds: 2700, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'tibetanBowls', category: 'FREQUENCY', durationSeconds: 3000, isPreview: false, requiredPlan: 'QUARTERLY' },
    { titleKey: 'binauralBeats', category: 'FREQUENCY', durationSeconds: 3600, isPreview: false, requiredPlan: 'QUARTERLY' },

    // Annual plan exclusive content
    { titleKey: 'exclusiveMasterclass', category: 'EXCLUSIVE', durationSeconds: 5400, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'premiumRetreat', category: 'EXCLUSIVE', durationSeconds: 7200, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'seasonalCollection', category: 'EXCLUSIVE', durationSeconds: 4800, isPreview: false, requiredPlan: 'ANNUAL' },
    { titleKey: 'liveSessionRecording', category: 'EXCLUSIVE', durationSeconds: 5400, isPreview: false, requiredPlan: 'ANNUAL' },
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
