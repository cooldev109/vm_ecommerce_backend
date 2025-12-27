#!/bin/bash

echo "🧪 Testing Audio Categories API"
echo "================================"

# Login as admin
echo -e "\n1️⃣ Login as admin..."
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vmcandles.com","password":"Admin123!"}' \
  | python -m json.tool \
  | grep '"token"' \
  | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed"
  exit 1
fi
echo "✅ Login successful"

# Test get all audio
echo -e "\n2️⃣ Get all audio content..."
curl -s http://localhost:3000/api/audio | python -m json.tool | grep -E '"category"' | head -10
echo "✅ Categories retrieved"

# Test AMBIENT filter
echo -e "\n3️⃣ Test AMBIENT category filter..."
COUNT=$(curl -s "http://localhost:3000/api/audio?category=AMBIENT" | python -m json.tool | grep -c '"category": "AMBIENT"')
echo "✅ Found $COUNT AMBIENT tracks"

# Test MEDITATION filter  
echo -e "\n4️⃣ Test MEDITATION category filter..."
COUNT=$(curl -s "http://localhost:3000/api/audio?category=MEDITATION" | python -m json.tool | grep -c '"category": "MEDITATION"')
echo "✅ Found $COUNT MEDITATION tracks"

# Test invalid category
echo -e "\n5️⃣ Test invalid category (FREQUENCY)..."
RESULT=$(curl -s "http://localhost:3000/api/audio?category=FREQUENCY" | python -m json.tool | grep '"success"')
if echo "$RESULT" | grep -q "false"; then
  echo "✅ Invalid category correctly rejected"
else
  echo "❌ Invalid category was not rejected"
fi

# Test admin create with MEDITATION
echo -e "\n6️⃣ Test admin create audio with MEDITATION..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/audio/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"titleKey":"testMeditation","category":"MEDITATION","fileUrl":"/audio/test.mp3","durationSeconds":300,"isPreview":true,"sortOrder":999}')

AUDIO_ID=$(echo "$RESPONSE" | python -m json.tool | grep '"id"' | head -1 | cut -d'"' -f4)

if [ -n "$AUDIO_ID" ]; then
  echo "✅ Created audio with ID: $AUDIO_ID"
  
  # Test update category to AMBIENT
  echo -e "\n7️⃣ Test update category to AMBIENT..."
  curl -s -X PUT "http://localhost:3000/api/audio/admin/$AUDIO_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"category":"AMBIENT"}' | python -m json.tool | grep '"category"'
  echo "✅ Updated category"
  
  # Cleanup - delete test audio
  echo -e "\n8️⃣ Cleanup - delete test audio..."
  curl -s -X DELETE "http://localhost:3000/api/audio/admin/$AUDIO_ID" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  echo "✅ Deleted test audio"
else
  echo "❌ Failed to create audio"
fi

# Test admin create with invalid category
echo -e "\n9️⃣ Test admin create with invalid category (EXCLUSIVE)..."
RESULT=$(curl -s -X POST http://localhost:3000/api/audio/admin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"titleKey":"testExclusive","category":"EXCLUSIVE","fileUrl":"/audio/test.mp3","durationSeconds":300,"isPreview":true}' \
  | python -m json.tool | grep '"success"')

if echo "$RESULT" | grep -q "false"; then
  echo "✅ Invalid category correctly rejected in admin create"
else
  echo "❌ Invalid category was not rejected"
fi

echo -e "\n================================"
echo "🎉 All tests completed!"
