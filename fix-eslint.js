#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run ESLint with auto-fix for the most common issues
console.log('Running ESLint auto-fix...');

try {
  // Fix trailing spaces, missing commas, missing newlines at EOF
  execSync('npx eslint . --fix --ext .ts,.tsx --rule "no-trailing-spaces: error" --rule "comma-dangle: error" --rule "eol-last: error"', {
    stdio: 'inherit'
  });
  console.log('✓ Fixed trailing spaces, commas, and EOF newlines');
  
  // Fix quotes
  execSync('npx eslint . --fix --ext .ts,.tsx --rule "quotes: [error, single]" --rule "jsx-quotes: [error, prefer-double]"', {
    stdio: 'inherit'
  });
  console.log('✓ Fixed quotes');
  
  // Fix spacing issues
  execSync('npx eslint . --fix --ext .ts,.tsx --rule "object-curly-spacing: [error, always]" --rule "array-bracket-spacing: [error, never]" --rule "keyword-spacing: error" --rule "space-infix-ops: error"', {
    stdio: 'inherit'
  });
  console.log('✓ Fixed spacing issues');
  
} catch (error) {
  console.error('Some files may still have errors that need manual fixing');
}

console.log('\nRunning full ESLint check...');
execSync('npm run lint', { stdio: 'inherit' });