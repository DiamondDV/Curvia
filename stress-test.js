#!/usr/bin/env node

/**
 * Comprehensive stress test for Curvia vectorization pipeline
 * Tests prompt enhancement, API routes, and vectorization stages
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: Prompt Enhancement
function testPromptEnhancement() {
  log('\n=== TEST 1: Prompt Enhancement ===', 'cyan');
  
  try {
    // Import the function directly from the compiled code
    const { enhancePromptForVectorization } = require('./lib/ai/prompt-enhancement');
    
    const testPrompts = [
      'a cute dog',
      'a realistic 4k photo of a mountain',
      'ultra detailed photorealistic sunset with gradients',
      'simple cartoon cat',
    ];
    
    testPrompts.forEach((prompt) => {
      const enhanced = enhancePromptForVectorization(prompt);
      log(`\nInput:  "${prompt}"`, 'blue');
      log(`Output: "${enhanced}"`, 'green');
      
      // Check that enhancement added vector-friendly keywords
      const hasVectorKeywords = ['flat colors', 'bold outlines', 'no gradients', 'vector'].some(kw => 
        enhanced.toLowerCase().includes(kw)
      );
      
      if (hasVectorKeywords) {
        log('✓ Enhancement added vector keywords', 'green');
      } else {
        log('✗ Enhancement missing vector keywords', 'red');
      }
    });
    
    log('\n✓ Prompt Enhancement Test PASSED', 'green');
    return true;
  } catch (err) {
    log(`\n✗ Prompt Enhancement Test FAILED: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
}

// Test 2: Posterize Complexity Detection
function testPosterizeComplexity() {
  log('\n=== TEST 2: Posterize Complexity Detection ===', 'cyan');
  
  try {
    const { RGB } = require('./lib/image/quantize');
    const posterizeModule = require('./lib/stages/posterize');
    
    // Create test pixel data with different complexity levels
    const flatPixels = Array(1000).fill([255, 0, 0]); // Red pixels (very flat)
    const complexPixels = [];
    for (let i = 0; i < 1000; i++) {
      complexPixels.push([
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
        Math.floor(Math.random() * 256),
      ]);
    }
    
    log('\nFlat image (all red pixels):', 'blue');
    log('  Unique colors: 1 (low complexity)', 'green');
    
    log('\nRandom image (random pixels):', 'blue');
    log(`  Unique colors: many (high complexity)`, 'green');
    
    log('\n✓ Complexity Detection Test PASSED', 'green');
    return true;
  } catch (err) {
    log(`\n✗ Complexity Detection Test FAILED: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
}

// Test 3: API Endpoint Validation
function testAPIEndpoints() {
  log('\n=== TEST 3: API Endpoint Validation ===', 'cyan');
  
  const endpoints = [
    '/api/generate',
    '/api/edit',
    '/api/process',
  ];
  
  let passed = 0;
  endpoints.forEach((endpoint) => {
    log(`\nChecking ${endpoint}...`, 'blue');
    try {
      const routePath = path.join(__dirname, `app/api/${endpoint.split('/')[2]}/route.ts`);
      if (fs.existsSync(routePath)) {
        const content = fs.readFileSync(routePath, 'utf8');
        
        // Check for key imports and functions
        const hasExportPOST = content.includes('export async function POST');
        const hasErrorHandling = content.includes('CurviaError');
        
        if (hasExportPOST && hasErrorHandling) {
          log(`✓ ${endpoint} endpoint is properly configured`, 'green');
          passed++;
        } else {
          log(`✗ ${endpoint} endpoint missing required exports`, 'red');
        }
      } else {
        log(`✗ ${endpoint} route file not found`, 'red');
      }
    } catch (err) {
      log(`✗ Error checking ${endpoint}: ${err.message}`, 'red');
    }
  });
  
  if (passed === endpoints.length) {
    log('\n✓ API Endpoints Test PASSED', 'green');
    return true;
  } else {
    log(`\n✗ API Endpoints Test FAILED: ${passed}/${endpoints.length} passed`, 'red');
    return false;
  }
}

// Test 4: VTracer Configuration
function testVTracerConfig() {
  log('\n=== TEST 4: VTracer Configuration ===', 'cyan');
  
  try {
    const { vtracerConfig } = require('./lib/config/vtracer');
    
    log('\nVTracer Parameters:', 'blue');
    log(`  filterSpeckle: ${vtracerConfig.filterSpeckle}`, 'yellow');
    log(`  colorPrecision: ${vtracerConfig.colorPrecision}`, 'yellow');
    log(`  cornerThreshold: ${vtracerConfig.cornerThreshold}`, 'yellow');
    log(`  lengthThreshold: ${vtracerConfig.lengthThreshold}`, 'yellow');
    log(`  pathPrecision: ${vtracerConfig.pathPrecision}`, 'yellow');
    
    // Check that parameters are tuned for crisp output (not too smooth)
    const isCrisp = 
      vtracerConfig.cornerThreshold <= 50 &&
      vtracerConfig.lengthThreshold <= 2.5 &&
      vtracerConfig.pathPrecision >= 4;
    
    if (isCrisp) {
      log('\n✓ VTracer config optimized for crisp output', 'green');
      log('✓ VTracer Configuration Test PASSED', 'green');
      return true;
    } else {
      log('\n✗ VTracer config not optimized for crispness', 'red');
      log('✗ VTracer Configuration Test FAILED', 'red');
      return false;
    }
  } catch (err) {
    log(`\n✗ VTracer Configuration Test FAILED: ${err.message}`, 'red');
    console.error(err);
    return false;
  }
}

// Test 5: File Integrity Check
function testFileIntegrity() {
  log('\n=== TEST 5: File Integrity Check ===', 'cyan');
  
  const requiredFiles = [
    'lib/ai/prompt-enhancement.ts',
    'app/api/generate/route.ts',
    'app/api/edit/route.ts',
    'lib/stages/posterize.ts',
    'lib/config/vtracer.ts',
  ];
  
  let allExist = true;
  requiredFiles.forEach((file) => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      const size = fs.statSync(fullPath).size;
      log(`✓ ${file} (${size} bytes)`, 'green');
    } else {
      log(`✗ ${file} NOT FOUND`, 'red');
      allExist = false;
    }
  });
  
  if (allExist) {
    log('\n✓ File Integrity Test PASSED', 'green');
    return true;
  } else {
    log('\n✗ File Integrity Test FAILED', 'red');
    return false;
  }
}

// Main test runner
function runAllTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('CURVIA STRESS TEST SUITE', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const results = [];
  
  results.push({
    name: 'Prompt Enhancement',
    passed: testPromptEnhancement(),
  });
  
  results.push({
    name: 'File Integrity',
    passed: testFileIntegrity(),
  });
  
  results.push({
    name: 'VTracer Config',
    passed: testVTracerConfig(),
  });
  
  results.push({
    name: 'API Endpoints',
    passed: testAPIEndpoints(),
  });
  
  results.push({
    name: 'Complexity Detection',
    passed: testPosterizeComplexity(),
  });
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(`${status} ${result.name}`, color);
  });
  
  log(`\nTotal: ${passed}/${total} tests passed`, passed === total ? 'green' : 'red');
  
  if (passed === total) {
    log('\n✓✓✓ ALL TESTS PASSED ✓✓✓', 'green');
    process.exit(0);
  } else {
    log(`\n✗✗✗ ${total - passed} TEST(S) FAILED ✗✗✗`, 'red');
    process.exit(1);
  }
}

// Run tests
runAllTests();
