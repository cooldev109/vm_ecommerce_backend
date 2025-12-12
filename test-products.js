/**
 * Products API Test Suite
 * Tests all product catalog endpoints
 */

const BASE_URL = 'http://localhost:3000/api';

// Helper function for making requests
async function request(method, endpoint, body = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

let adminToken = null;

console.log('\n🧪 ===== PRODUCTS API TEST SUITE =====\n');

// Test 1: Get admin token first
async function testGetAdminToken() {
  console.log('1️⃣  Getting admin token for protected routes');

  const { status, data } = await request('POST', '/auth/login', {
    email: 'admin@vmcandles.com',
    password: 'Admin123!',
  });

  if (status === 200 && data.success && data.data.token) {
    console.log('   ✅ Admin token obtained');
    adminToken = data.data.token;
    return true;
  } else {
    console.log('   ❌ Failed to get admin token');
    return false;
  }
}

// Test 2: Get all products (default)
async function testGetAllProducts() {
  console.log('\n2️⃣  Testing GET /api/products (all products)');

  const { status, data } = await request('GET', '/products');

  if (status === 200 && data.success && Array.isArray(data.data.products)) {
    console.log(`   ✅ Retrieved ${data.data.products.length} products`);
    console.log(`   📊 Total: ${data.data.pagination.total}`);
    console.log(`   📄 Page: ${data.data.pagination.page}/${data.data.pagination.totalPages}`);

    // Show sample products
    if (data.data.products.length > 0) {
      const sample = data.data.products[0];
      console.log(`   Sample: "${sample.name}" - $${sample.price} (${sample.category})`);
    }
    return true;
  } else {
    console.log('   ❌ Failed to get products');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 3: Get products with category filter
async function testGetProductsByCategory() {
  console.log('\n3️⃣  Testing GET /api/products?category=CANDLES');

  const { status, data } = await request('GET', '/products?category=CANDLES');

  if (status === 200 && data.success) {
    const allCandles = data.data.products.every(p => p.category === 'CANDLES');
    if (allCandles) {
      console.log(`   ✅ Retrieved ${data.data.products.length} candles`);
      return true;
    } else {
      console.log('   ❌ Some products are not candles');
      return false;
    }
  } else {
    console.log('   ❌ Failed to filter by category');
    return false;
  }
}

// Test 4: Get products with featured filter
async function testGetFeaturedProducts() {
  console.log('\n4️⃣  Testing GET /api/products?featured=true');

  const { status, data } = await request('GET', '/products?featured=true');

  if (status === 200 && data.success) {
    console.log(`   ✅ Retrieved ${data.data.products.length} featured products`);
    return true;
  } else {
    console.log('   ❌ Failed to filter featured products');
    return false;
  }
}

// Test 5: Get products with pagination
async function testGetProductsPagination() {
  console.log('\n5️⃣  Testing GET /api/products?page=1&limit=5');

  const { status, data } = await request('GET', '/products?page=1&limit=5');

  if (status === 200 && data.success) {
    const hasCorrectLimit = data.data.products.length <= 5;
    console.log(`   ✅ Retrieved ${data.data.products.length} products (limit: 5)`);
    console.log(`   📊 Has more: ${data.data.pagination.hasMore}`);
    return hasCorrectLimit;
  } else {
    console.log('   ❌ Failed to paginate products');
    return false;
  }
}

// Test 6: Get products in different language
async function testGetProductsInEnglish() {
  console.log('\n6️⃣  Testing GET /api/products?language=EN');

  const { status, data } = await request('GET', '/products?language=EN');

  if (status === 200 && data.success) {
    console.log(`   ✅ Retrieved products in English`);
    if (data.data.products.length > 0) {
      console.log(`   Sample: "${data.data.products[0].name}"`);
    }
    return true;
  } else {
    console.log('   ❌ Failed to get products in English');
    return false;
  }
}

// Test 7: Get single product by ID
async function testGetProductById() {
  console.log('\n7️⃣  Testing GET /api/products/:id');

  const { status, data } = await request('GET', '/products/1');

  if (status === 200 && data.success && data.data.product) {
    console.log(`   ✅ Retrieved product: "${data.data.product.name}"`);
    console.log(`   💰 Price: $${data.data.product.price}`);
    console.log(`   📦 Category: ${data.data.product.category}`);
    console.log(`   ✅ In Stock: ${data.data.product.inStock}`);
    return true;
  } else {
    console.log('   ❌ Failed to get product by ID');
    return false;
  }
}

// Test 8: Get non-existent product
async function testGetNonExistentProduct() {
  console.log('\n8️⃣  Testing GET /api/products/nonexistent');

  const { status, data } = await request('GET', '/products/nonexistent');

  if (status === 404 && data.error.code === 'PRODUCT_NOT_FOUND') {
    console.log('   ✅ Correctly returned 404 for non-existent product');
    return true;
  } else {
    console.log('   ❌ Should have returned 404');
    return false;
  }
}

// Test 9: Get product translations
async function testGetProductTranslations() {
  console.log('\n9️⃣  Testing GET /api/products/:id/translations');

  const { status, data } = await request('GET', '/products/1/translations');

  if (status === 200 && data.success && Array.isArray(data.data.translations)) {
    console.log(`   ✅ Retrieved ${data.data.translations.length} translation(s)`);
    data.data.translations.forEach(t => {
      console.log(`      - ${t.language}: "${t.name}"`);
    });
    return true;
  } else {
    console.log('   ❌ Failed to get translations');
    return false;
  }
}

// Test 10: Create product (admin only)
async function testCreateProduct() {
  console.log('\n🔟 Testing POST /api/products (admin)');

  if (!adminToken) {
    console.log('   ⚠️  Skipped - no admin token');
    return false;
  }

  const newProduct = {
    id: `test-${Date.now()}`,
    category: 'CANDLES',
    price: 35.00,
    image: '/images/test-candle.jpg',
    images: ['/images/test-candle-1.jpg', '/images/test-candle-2.jpg'],
    inStock: true,
    burnTime: '40-45 hours',
    size: '200g',
    featured: false,
    sortOrder: 999,
    translations: [
      {
        language: 'ES',
        name: 'Vela de Prueba',
        description: 'Una vela de prueba',
        longDescription: 'Descripción larga de la vela de prueba',
        features: ['Cera natural', 'Aroma relajante']
      }
    ]
  };

  const { status, data } = await request('POST', '/products', newProduct, adminToken);

  if (status === 201 && data.success && data.data.product) {
    console.log(`   ✅ Product created: "${data.data.product.translations[0].name}"`);
    console.log(`   🆔 ID: ${data.data.product.id}`);
    return true;
  } else {
    console.log('   ❌ Failed to create product');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 11: Create product without admin token
async function testCreateProductNoAuth() {
  console.log('\n1️⃣1️⃣  Testing POST /api/products (no auth)');

  const newProduct = {
    id: 'should-fail',
    category: 'CANDLES',
    price: 35.00,
    image: '/images/test.jpg',
  };

  const { status, data } = await request('POST', '/products', newProduct);

  if (status === 401 && data.error.code === 'NO_TOKEN') {
    console.log('   ✅ Correctly rejected request without auth');
    return true;
  } else {
    console.log('   ❌ Should have rejected unauthorized request');
    return false;
  }
}

// Test 12: Update product (admin only)
async function testUpdateProduct() {
  console.log('\n1️⃣2️⃣  Testing PUT /api/products/:id (admin)');

  if (!adminToken) {
    console.log('   ⚠️  Skipped - no admin token');
    return false;
  }

  const updates = {
    price: 50.00,
    featured: true,
  };

  const { status, data } = await request('PUT', '/products/1', updates, adminToken);

  if (status === 200 && data.success && data.data.product) {
    console.log(`   ✅ Product updated`);
    console.log(`   💰 New price: $${data.data.product.price}`);
    console.log(`   ⭐ Featured: ${data.data.product.featured}`);
    return true;
  } else {
    console.log('   ❌ Failed to update product');
    return false;
  }
}

// Test 13: Update product translation
async function testUpdateProductTranslation() {
  console.log('\n1️⃣3️⃣  Testing PUT /api/products/:id/translations/:language (admin)');

  if (!adminToken) {
    console.log('   ⚠️  Skipped - no admin token');
    return false;
  }

  const translation = {
    name: 'Test Candle EN',
    description: 'A test candle description',
    longDescription: 'A longer test candle description',
    features: ['Natural wax', 'Relaxing scent']
  };

  const { status, data } = await request('PUT', '/products/1/translations/EN', translation, adminToken);

  if (status === 200 && data.success && data.data.translation) {
    console.log(`   ✅ Translation updated: "${data.data.translation.name}"`);
    console.log(`   🌐 Language: ${data.data.translation.language}`);
    return true;
  } else {
    console.log('   ❌ Failed to update translation');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 14: Delete product (admin only)
async function testDeleteProduct() {
  console.log('\n1️⃣4️⃣  Testing DELETE /api/products/:id (admin)');

  if (!adminToken) {
    console.log('   ⚠️  Skipped - no admin token');
    return false;
  }

  // First create a product to delete
  const tempProduct = {
    id: `delete-test-${Date.now()}`,
    category: 'ACCESSORIES',
    price: 10.00,
    image: '/images/temp.jpg',
  };

  const createResponse = await request('POST', '/products', tempProduct, adminToken);

  if (createResponse.status !== 201) {
    console.log('   ⚠️  Failed to create temp product for deletion test');
    return false;
  }

  const { status, data } = await request('DELETE', `/products/${tempProduct.id}`, null, adminToken);

  if (status === 200 && data.success) {
    console.log(`   ✅ Product deleted successfully`);
    return true;
  } else {
    console.log('   ❌ Failed to delete product');
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = [];

  results.push(await testGetAdminToken());
  results.push(await testGetAllProducts());
  results.push(await testGetProductsByCategory());
  results.push(await testGetFeaturedProducts());
  results.push(await testGetProductsPagination());
  results.push(await testGetProductsInEnglish());
  results.push(await testGetProductById());
  results.push(await testGetNonExistentProduct());
  results.push(await testGetProductTranslations());
  results.push(await testCreateProduct());
  results.push(await testCreateProductNoAuth());
  results.push(await testUpdateProduct());
  results.push(await testUpdateProductTranslation());
  results.push(await testDeleteProduct());

  const passed = results.filter(r => r === true).length;
  const failed = results.length - passed;

  console.log('\n🎉 ===== TEST SUMMARY =====\n');
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n   🎊 ALL TESTS PASSED! Phase 3 complete.\n');
    process.exit(0);
  } else {
    console.log('\n   ⚠️  Some tests failed. Review the output above.\n');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
