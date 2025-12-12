/**
 * Authentication API Test Suite
 * Tests all authentication and profile endpoints
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

// Test data
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'Test123!@#',
  firstName: 'Test',
  lastName: 'User',
  phone: '+56912345678',
  customerType: 'INDIVIDUAL',
  preferredLanguage: 'ES',
};

let authToken = null;
let addressId = null;

console.log('\n🧪 ===== AUTHENTICATION API TEST SUITE =====\n');

// Test 1: Register new user
async function testRegister() {
  console.log('1️⃣  Testing POST /api/auth/register');

  const { status, data } = await request('POST', '/auth/register', testUser);

  if (status === 201 && data.success && data.data.token) {
    console.log('   ✅ User registered successfully');
    console.log(`   📧 Email: ${testUser.email}`);
    console.log(`   👤 User ID: ${data.data.user.id}`);
    console.log(`   🔑 Token received: ${data.data.token.substring(0, 20)}...`);
    authToken = data.data.token;
    return true;
  } else {
    console.log('   ❌ Registration failed');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 2: Try to register duplicate email
async function testDuplicateRegister() {
  console.log('\n2️⃣  Testing duplicate email registration');

  const { status, data } = await request('POST', '/auth/register', testUser);

  if (status === 400 && data.error.code === 'USER_EXISTS') {
    console.log('   ✅ Correctly rejected duplicate email');
    return true;
  } else {
    console.log('   ❌ Should have rejected duplicate email');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 3: Login with correct credentials
async function testLogin() {
  console.log('\n3️⃣  Testing POST /api/auth/login');

  const { status, data } = await request('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password,
  });

  if (status === 200 && data.success && data.data.token) {
    console.log('   ✅ Login successful');
    console.log(`   🔑 Token received: ${data.data.token.substring(0, 20)}...`);
    console.log(`   👤 User: ${data.data.user.profile.firstName} ${data.data.user.profile.lastName}`);
    authToken = data.data.token;
    return true;
  } else {
    console.log('   ❌ Login failed');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 4: Login with wrong password
async function testWrongPassword() {
  console.log('\n4️⃣  Testing login with wrong password');

  const { status, data } = await request('POST', '/auth/login', {
    email: testUser.email,
    password: 'WrongPassword123!',
  });

  if (status === 401 && data.error.code === 'INVALID_CREDENTIALS') {
    console.log('   ✅ Correctly rejected wrong password');
    return true;
  } else {
    console.log('   ❌ Should have rejected wrong password');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 5: Get current user (authenticated)
async function testGetMe() {
  console.log('\n5️⃣  Testing GET /api/auth/me (authenticated)');

  const { status, data } = await request('GET', '/auth/me', null, authToken);

  if (status === 200 && data.success && data.data.user) {
    console.log('   ✅ Successfully retrieved user data');
    console.log(`   👤 Name: ${data.data.user.profile.firstName} ${data.data.user.profile.lastName}`);
    console.log(`   📧 Email: ${data.data.user.email}`);
    console.log(`   🔰 Role: ${data.data.user.role}`);
    return true;
  } else {
    console.log('   ❌ Failed to get user data');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 6: Try to access protected route without token
async function testNoToken() {
  console.log('\n6️⃣  Testing GET /api/auth/me without token');

  const { status, data } = await request('GET', '/auth/me');

  if (status === 401 && data.error.code === 'NO_TOKEN') {
    console.log('   ✅ Correctly rejected request without token');
    return true;
  } else {
    console.log('   ❌ Should have rejected request without token');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 7: Get profile
async function testGetProfile() {
  console.log('\n7️⃣  Testing GET /api/profile');

  const { status, data } = await request('GET', '/profile', null, authToken);

  if (status === 200 && data.success && data.data.profile) {
    console.log('   ✅ Successfully retrieved profile');
    console.log(`   👤 ${data.data.profile.firstName} ${data.data.profile.lastName}`);
    console.log(`   📱 Phone: ${data.data.profile.phone || 'Not set'}`);
    console.log(`   🌐 Language: ${data.data.profile.preferredLanguage}`);
    return true;
  } else {
    console.log('   ❌ Failed to get profile');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 8: Update profile
async function testUpdateProfile() {
  console.log('\n8️⃣  Testing PUT /api/profile');

  const { status, data } = await request('PUT', '/profile', {
    firstName: 'Updated',
    lastName: 'Name',
    phone: '+56987654321',
  }, authToken);

  if (status === 200 && data.success && data.data.profile) {
    console.log('   ✅ Profile updated successfully');
    console.log(`   👤 New name: ${data.data.profile.firstName} ${data.data.profile.lastName}`);
    console.log(`   📱 New phone: ${data.data.profile.phone}`);
    return true;
  } else {
    console.log('   ❌ Failed to update profile');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 9: Create address
async function testCreateAddress() {
  console.log('\n9️⃣  Testing POST /api/profile/addresses');

  const { status, data } = await request('POST', '/profile/addresses', {
    type: 'SHIPPING',
    street: 'Av. Libertador Bernardo O\'Higgins 1234',
    city: 'Santiago',
    region: 'Región Metropolitana',
    postalCode: '8320000',
    country: 'Chile',
    isDefault: true,
  }, authToken);

  if (status === 201 && data.success && data.data.address) {
    console.log('   ✅ Address created successfully');
    console.log(`   📍 ${data.data.address.street}, ${data.data.address.city}`);
    console.log(`   🔰 Default: ${data.data.address.isDefault}`);
    addressId = data.data.address.id;
    return true;
  } else {
    console.log('   ❌ Failed to create address');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 10: Get all addresses
async function testGetAddresses() {
  console.log('\n🔟 Testing GET /api/profile/addresses');

  const { status, data } = await request('GET', '/profile/addresses', null, authToken);

  if (status === 200 && data.success && Array.isArray(data.data.addresses)) {
    console.log(`   ✅ Retrieved ${data.data.addresses.length} address(es)`);
    data.data.addresses.forEach((addr, i) => {
      console.log(`   📍 ${i + 1}. ${addr.street}, ${addr.city} (${addr.type})`);
    });
    return true;
  } else {
    console.log('   ❌ Failed to get addresses');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 11: Update address
async function testUpdateAddress() {
  console.log('\n1️⃣1️⃣  Testing PUT /api/profile/addresses/:id');

  if (!addressId) {
    console.log('   ⚠️  Skipped - no address ID available');
    return false;
  }

  const { status, data } = await request('PUT', `/profile/addresses/${addressId}`, {
    type: 'SHIPPING',
    street: 'Nueva Dirección 5678',
    city: 'Valparaíso',
    region: 'Región de Valparaíso',
    postalCode: '2340000',
    country: 'Chile',
    isDefault: true,
  }, authToken);

  if (status === 200 && data.success && data.data.address) {
    console.log('   ✅ Address updated successfully');
    console.log(`   📍 New address: ${data.data.address.street}, ${data.data.address.city}`);
    return true;
  } else {
    console.log('   ❌ Failed to update address');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 12: Delete address
async function testDeleteAddress() {
  console.log('\n1️⃣2️⃣  Testing DELETE /api/profile/addresses/:id');

  if (!addressId) {
    console.log('   ⚠️  Skipped - no address ID available');
    return false;
  }

  const { status, data } = await request('DELETE', `/profile/addresses/${addressId}`, null, authToken);

  if (status === 200 && data.success) {
    console.log('   ✅ Address deleted successfully');
    return true;
  } else {
    console.log('   ❌ Failed to delete address');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 13: Logout
async function testLogout() {
  console.log('\n1️⃣3️⃣  Testing POST /api/auth/logout');

  const { status, data } = await request('POST', '/auth/logout', null, authToken);

  if (status === 200 && data.success) {
    console.log('   ✅ Logout successful');
    return true;
  } else {
    console.log('   ❌ Logout failed');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 14: Login with existing test user
async function testExistingUserLogin() {
  console.log('\n1️⃣4️⃣  Testing login with existing test user');

  const { status, data } = await request('POST', '/auth/login', {
    email: 'test@example.com',
    password: 'Test123!',
  });

  if (status === 200 && data.success && data.data.token) {
    console.log('   ✅ Existing user login successful');
    console.log(`   👤 User: ${data.data.user.profile.firstName} ${data.data.user.profile.lastName}`);
    return true;
  } else {
    console.log('   ❌ Existing user login failed');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Test 15: Login with admin user
async function testAdminLogin() {
  console.log('\n1️⃣5️⃣  Testing login with admin user');

  const { status, data } = await request('POST', '/auth/login', {
    email: 'admin@vmcandles.com',
    password: 'Admin123!',
  });

  if (status === 200 && data.success && data.data.token && data.data.user.role === 'ADMIN') {
    console.log('   ✅ Admin login successful');
    console.log(`   👤 User: ${data.data.user.profile.firstName} ${data.data.user.profile.lastName}`);
    console.log(`   🔰 Role: ${data.data.user.role}`);
    return true;
  } else {
    console.log('   ❌ Admin login failed');
    console.log('   Response:', JSON.stringify(data, null, 2));
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = [];

  results.push(await testRegister());
  results.push(await testDuplicateRegister());
  results.push(await testLogin());
  results.push(await testWrongPassword());
  results.push(await testGetMe());
  results.push(await testNoToken());
  results.push(await testGetProfile());
  results.push(await testUpdateProfile());
  results.push(await testCreateAddress());
  results.push(await testGetAddresses());
  results.push(await testUpdateAddress());
  results.push(await testDeleteAddress());
  results.push(await testLogout());
  results.push(await testExistingUserLogin());
  results.push(await testAdminLogin());

  const passed = results.filter(r => r === true).length;
  const failed = results.length - passed;

  console.log('\n🎉 ===== TEST SUMMARY =====\n');
  console.log(`   Total Tests: ${results.length}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n   🎊 ALL TESTS PASSED! Phase 2 complete.\n');
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
