/**
 * Test script to verify Vercel + Pusher setup
 * Run with: node test-setup.js
 */

const Pusher = require('pusher');

// Test Pusher connection
async function testPusher() {
  console.log('🧪 Testing Pusher connection...');
  
  const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || 'test',
    key: process.env.PUSHER_KEY || 'test',
    secret: process.env.PUSHER_SECRET || 'test',
    cluster: process.env.PUSHER_CLUSTER || 'us2',
    useTLS: true
  });

  try {
    // Test triggering an event
    await pusher.trigger('test-channel', 'test-event', {
      message: 'Hello from test script!',
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Pusher connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Pusher connection failed:', error.message);
    return false;
  }
}

// Test API endpoint
async function testAPI() {
  console.log('🧪 Testing API endpoint...');
  
  try {
    const response = await fetch('http://localhost:3000/api/signaling', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        fromDeviceId: 'test-device-1',
        toDeviceId: 'test-device-2',
        familyId: 'test-family',
        data: { test: true }
      })
    });
    
    if (response.ok) {
      console.log('✅ API endpoint working!');
      return true;
    } else {
      console.error('❌ API endpoint failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ API endpoint error:', error.message);
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Kids Call Home setup tests...\n');
  
  const pusherTest = await testPusher();
  const apiTest = await testAPI();
  
  console.log('\n📊 Test Results:');
  console.log(`Pusher: ${pusherTest ? '✅' : '❌'}`);
  console.log(`API: ${apiTest ? '✅' : '❌'}`);
  
  if (pusherTest && apiTest) {
    console.log('\n🎉 All tests passed! Your setup is ready for deployment.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check your configuration.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testPusher, testAPI, runTests };
