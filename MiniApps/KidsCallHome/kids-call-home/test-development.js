/**
 * Test script for development setup
 * Run with: node test-development.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');

console.log('🧪 Testing Kids Call Home development setup...\n');

// Test 1: Check if development server starts
function testDevServer() {
  return new Promise((resolve) => {
    console.log('1️⃣ Testing development server...');
    
    const server = spawn('node', ['dev-server.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    server.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    // Wait for server to start
    setTimeout(() => {
      if (output.includes('Development API server running')) {
        console.log('✅ Development server started successfully');
        server.kill();
        resolve(true);
      } else {
        console.log('❌ Development server failed to start');
        console.log('Output:', output);
        server.kill();
        resolve(false);
      }
    }, 3000);
  });
}

// Test 2: Check API endpoint
async function testAPI() {
  console.log('2️⃣ Testing API endpoint...');
  
  try {
    const response = await fetch('http://localhost:3001/api/health');
    if (response.ok) {
      console.log('✅ API endpoint is working');
      return true;
    } else {
      console.log('❌ API endpoint returned error:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ API endpoint test failed:', error.message);
    return false;
  }
}

// Test 3: Check if Vite builds
function testViteBuild() {
  return new Promise((resolve) => {
    console.log('3️⃣ Testing Vite build...');
    
    const build = spawn('npm', ['run', 'build'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    build.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    build.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    build.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Vite build successful');
        resolve(true);
      } else {
        console.log('❌ Vite build failed');
        console.log('Output:', output);
        resolve(false);
      }
    });
  });
}

// Run all tests
async function runTests() {
  const serverTest = await testDevServer();
  const apiTest = await testAPI();
  const buildTest = await testViteBuild();
  
  console.log('\n📊 Test Results:');
  console.log(`Development Server: ${serverTest ? '✅' : '❌'}`);
  console.log(`API Endpoint: ${apiTest ? '✅' : '❌'}`);
  console.log(`Vite Build: ${buildTest ? '✅' : '❌'}`);
  
  if (serverTest && apiTest && buildTest) {
    console.log('\n🎉 All tests passed! Your development setup is ready.');
    console.log('\n🚀 To start development:');
    console.log('   npm run dev:full');
    console.log('\n📱 To test the app:');
    console.log('   1. Open two browser tabs');
    console.log('   2. Go to http://localhost:3000');
    console.log('   3. Login as guardian in one tab, child in another');
    console.log('   4. Try calling between them!');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

// Run tests
runTests().catch(console.error);
