-- Fix product image paths in production database
-- This replaces /uploads/products/* paths with correct /src/assets/* paths

-- Update candle products
UPDATE "Product" SET
  "image" = '/src/assets/product-vanilla-candle.jpg',
  "images" = ARRAY['/src/assets/product-vanilla-candle.jpg']
WHERE id = '1';

UPDATE "Product" SET
  "image" = '/src/assets/product-lavender-candle.jpg',
  "images" = ARRAY['/src/assets/product-lavender-candle.jpg']
WHERE id = '2';

UPDATE "Product" SET
  "image" = '/src/assets/product-eucalyptus-candle.jpg',
  "images" = ARRAY['/src/assets/product-eucalyptus-candle.jpg']
WHERE id = '3';

UPDATE "Product" SET
  "image" = '/src/assets/product-rose-candle.jpg',
  "images" = ARRAY['/src/assets/product-rose-candle.jpg']
WHERE id = '4';

UPDATE "Product" SET
  "image" = '/src/assets/product-citrus-candle.jpg',
  "images" = ARRAY['/src/assets/product-citrus-candle.jpg']
WHERE id = '5';

UPDATE "Product" SET
  "image" = '/src/assets/product-sandalwood-candle.jpg',
  "images" = ARRAY['/src/assets/product-sandalwood-candle.jpg']
WHERE id = '6';

UPDATE "Product" SET
  "image" = '/src/assets/product-cedarwood-candle.jpg',
  "images" = ARRAY['/src/assets/product-cedarwood-candle.jpg']
WHERE id = '7';

UPDATE "Product" SET
  "image" = '/src/assets/product-bergamot-candle.jpg',
  "images" = ARRAY['/src/assets/product-bergamot-candle.jpg']
WHERE id = '8';

UPDATE "Product" SET
  "image" = '/src/assets/product-peony-candle.jpg',
  "images" = ARRAY['/src/assets/product-peony-candle.jpg']
WHERE id = '9';

UPDATE "Product" SET
  "image" = '/src/assets/product-amber-candle.jpg',
  "images" = ARRAY['/src/assets/product-amber-candle.jpg']
WHERE id = '10';

UPDATE "Product" SET
  "image" = '/src/assets/product-jasmine-candle.jpg',
  "images" = ARRAY['/src/assets/product-jasmine-candle.jpg']
WHERE id = '15';

UPDATE "Product" SET
  "image" = '/src/assets/V&M Calm  Ritual.jpg',
  "images" = ARRAY['/src/assets/V&M Calm  Ritual.jpg']
WHERE id = '17';

UPDATE "Product" SET
  "image" = '/src/assets/product-rose-candle.jpg',
  "images" = ARRAY['/src/assets/product-rose-candle.jpg']
WHERE id = '18';

-- Update accessory products (THE BROKEN ONES!)
UPDATE "Product" SET
  "image" = '/src/assets/accessory-snuffer.jpg',
  "images" = ARRAY['/src/assets/accessory-snuffer.jpg']
WHERE id = 'acc-1';

UPDATE "Product" SET
  "image" = '/src/assets/accessory-trimmer.jpg',
  "images" = ARRAY['/src/assets/accessory-trimmer.jpg']
WHERE id = 'acc-2';

UPDATE "Product" SET
  "image" = '/src/assets/accessory-dipper.jpg',
  "images" = ARRAY['/src/assets/accessory-dipper.jpg']
WHERE id = 'acc-3';

-- Verify the changes
SELECT id, "image", "images"[1] as first_image FROM "Product" ORDER BY id;
