/**
 * Test script for Audio Categories (AMBIENT and MEDITATION only)
 * Tests both public and admin endpoints
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api';
const ADMIN_EMAIL = 'admin@vmcandles.com';
const ADMIN_PASSWORD = 'Admin123!';

let adminToken = '';

async function login() {
  console.log('\n🔐 Logging in as admin...');
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });

  const data = await response.json();
  if (data.success) {
    adminToken = data.data.token;
    console.log('✅ Admin login successful');
    return true;
  }
  console.error('❌ Admin login failed:', data.error);
  return false;
}

async function testPublicEndpoint() {
  console.log('\n📡 Testing public /api/audio endpoint...');

  const response = await fetch(`${BASE_URL}/audio`);
  const data = await response.json();

  if (data.success) {
    const categories = [...new Set(data.data.audioContent.map(a => a.category))];
    console.log(`✅ Found ${data.data.audioContent.length} audio tracks`);
    console.log(`📊 Categories: ${categories.join(', ')}`);

    // Verify only AMBIENT and MEDITATION exist
    const invalidCategories = categories.filter(c => !['AMBIENT', 'MEDITATION'].includes(c));
    if (invalidCategories.length > 0) {
      console.error(`❌ Found invalid categories: ${invalidCategories.join(', ')}`);
      return false;
    }
    console.log('✅ All categories are valid (AMBIENT or MEDITATION)');
    return true;
  }

  console.error('❌ Failed to fetch audio content:', data.error);
  return false;
}

async function testCategoryFilter(category) {
  console.log(`\n🔍 Testing category filter: ${category}...`);

  const response = await fetch(`${BASE_URL}/audio?category=${category}`);
  const data = await response.json();

  if (data.success) {
    const allMatch = data.data.audioContent.every(a => a.category === category);
    console.log(`✅ Found ${data.data.audioContent.length} ${category} tracks`);

    if (allMatch) {
      console.log(`✅ All tracks are ${category}`);
      return true;
    } else {
      console.error(`❌ Some tracks don't match category ${category}`);
      return false;
    }
  }

  console.error(`❌ Failed to filter by ${category}:`, data.error);
  return false;
}

async function testInvalidCategory() {
  console.log('\n🚫 Testing invalid category (FREQUENCY)...');

  const response = await fetch(`${BASE_URL}/audio?category=FREQUENCY`);
  const data = await response.json();

  if (!data.success) {
    console.log('✅ Invalid category correctly rejected');
    return true;
  }

  console.error('❌ Invalid category was not rejected');
  return false;
}

async function testAdminCreateAudio() {
  console.log('\n➕ Testing admin create audio with MEDITATION category...');

  const testAudio = {
    titleKey: 'testMeditation',
    category: 'MEDITATION',
    fileUrl: '/audio/test-meditation.mp3',
    durationSeconds: 300,
    isPreview: true,
    sortOrder: 999
  };

  const response = await fetch(`${BASE_URL}/audio/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(testAudio)
  });

  const data = await response.json();

  if (data.success) {
    console.log('✅ Created test audio:', data.data.audio.titleKey);
    return data.data.audio.id;
  }

  console.error('❌ Failed to create audio:', data.error);
  return null;
}

async function testAdminCreateInvalidCategory() {
  console.log('\n🚫 Testing admin create with invalid category (EXCLUSIVE)...');

  const testAudio = {
    titleKey: 'testExclusive',
    category: 'EXCLUSIVE',
    fileUrl: '/audio/test-exclusive.mp3',
    durationSeconds: 300,
    isPreview: true,
    sortOrder: 998
  };

  const response = await fetch(`${BASE_URL}/audio/admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(testAudio)
  });

  const data = await response.json();

  if (!data.success) {
    console.log('✅ Invalid category correctly rejected in admin create');
    return true;
  }

  console.error('❌ Invalid category was not rejected in admin create');
  return false;
}

async function testAdminUpdateCategory(audioId) {
  console.log('\n✏️ Testing admin update category to AMBIENT...');

  const response = await fetch(`${BASE_URL}/audio/admin/${audioId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ category: 'AMBIENT' })
  });

  const data = await response.json();

  if (data.success && data.data.audio.category === 'AMBIENT') {
    console.log('✅ Updated category to AMBIENT');
    return true;
  }

  console.error('❌ Failed to update category:', data.error);
  return false;
}

async function testAdminDeleteAudio(audioId) {
  console.log('\n🗑️  Testing admin delete audio...');

  const response = await fetch(`${BASE_URL}/audio/admin/${audioId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  const data = await response.json();

  if (data.success) {
    console.log('✅ Deleted test audio');
    return true;
  }

  console.error('❌ Failed to delete audio:', data.error);
  return false;
}

async function runAllTests() {
  console.log('🧪 Starting Audio Category Tests\n');
  console.log('=' .repeat(50));

  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };

  const incrementResult = (passed) => {
    results.total++;
    if (passed) results.passed++;
    else results.failed++;
  };

  // Login
  if (!await login()) {
    console.error('\n❌ Cannot continue without admin login');
    return;
  }

  // Public endpoint tests
  incrementResult(await testPublicEndpoint());
  incrementResult(await testCategoryFilter('AMBIENT'));
  incrementResult(await testCategoryFilter('MEDITATION'));
  incrementResult(await testInvalidCategory());

  // Admin tests
  const audioId = await testAdminCreateAudio();
  incrementResult(audioId !== null);

  incrementResult(await testAdminCreateInvalidCategory());

  if (audioId) {
    incrementResult(await testAdminUpdateCategory(audioId));
    incrementResult(await testAdminDeleteAudio(audioId));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   Total: ${results.total}`);
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log('='.repeat(50));

  if (results.failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed');
  }
}

runAllTests().catch(console.error);
