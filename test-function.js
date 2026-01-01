// Test create-customer-portal-session Edge Function
// Run this with: node test-function.js

const https = require('https');

// You need to provide these values:
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'YOUR_ANON_KEY_HERE';
const ACCESS_TOKEN = process.argv[2] || 'YOUR_ACCESS_TOKEN_HERE';

if (SUPABASE_ANON_KEY === 'YOUR_ANON_KEY_HERE' || ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
  console.error('❌ Please provide your anon key and access token!');
  console.log('\nUsage:');
  console.log('  node test-function.js YOUR_ACCESS_TOKEN');
  console.log('\nOr set VITE_SUPABASE_PUBLISHABLE_KEY in your environment');
  process.exit(1);
}

const url = 'https://itmhojbjfacocrpmslmt.supabase.co/functions/v1/create-customer-portal-session';
const body = JSON.stringify({
  returnUrl: 'https://www.kidscallhome.com/parent/upgrade'
});

const options = {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY
  }
};

console.log('🧪 Testing create-customer-portal-session function...\n');
console.log('📡 URL:', url);
console.log('📤 Body:', body);
console.log('\n⏳ Sending request...\n');

const req = https.request(url, options, (res) => {
  console.log('📊 Status:', res.statusCode, res.statusMessage);
  console.log('📋 Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📄 Response Body:');
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
      if (res.statusCode === 200 && json.success) {
        console.log('\n✅ SUCCESS! Function is working!');
      } else {
        console.log('\n⚠️ Function returned an error');
      }
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(body);
req.end();



