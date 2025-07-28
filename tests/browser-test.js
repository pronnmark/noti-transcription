const { chromium } = require('playwright');

async function testApplication() {
  console.log('🚀 Starting browser test...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('📱 Testing application at http://localhost:5173');
    
    // Test 1: Main page loads
    console.log('✅ Test 1: Loading main page...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    
    const title = await page.title();
    console.log(`   Title: ${title}`);
    
    // Test 2: Login functionality
    console.log('✅ Test 2: Testing login...');
    await page.goto('http://localhost:5173/login');
    await page.waitForTimeout(1000);
    
    // Fill login form
    await page.fill('input[type="password"]', 'ddash');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Test 3: Navigate to files page
    console.log('✅ Test 3: Navigating to files page...');
    await page.goto('http://localhost:5173/files');
    await page.waitForTimeout(3000);
    
    // Check for content
    const filesContent = await page.textContent('body');
    console.log('   Files page loaded:', filesContent.includes('Files') || filesContent.includes('Upload'));
    
    // Test 4: Check API integration
    console.log('✅ Test 4: Testing API integration...');
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/files');
      return await res.json();
    });
    console.log('   API response:', response);
    
    // Test 5: Settings page
    console.log('✅ Test 5: Testing settings page...');
    await page.goto('http://localhost:5173/settings');
    await page.waitForTimeout(2000);
    
    // Test 6: AI summarization page
    console.log('✅ Test 6: Testing AI summarization page...');
    await page.goto('http://localhost:5173/ai/summarization');
    await page.waitForTimeout(2000);
    
    console.log('🎉 Browser testing completed!');
    
  } catch (error) {
    console.error('❌ Browser test failed:', error);
  } finally {
    await browser.close();
  }
}

testApplication();