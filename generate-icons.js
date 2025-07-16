const fs = require('fs');
const path = require('path');

// Simple SVG icon for Noti
const iconSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="512" height="512" rx="108" fill="url(#gradient)"/>
  
  <!-- Microphone body -->
  <rect x="206" y="120" width="100" height="180" rx="50" fill="white" opacity="0.9"/>
  
  <!-- Microphone mesh -->
  <rect x="226" y="140" width="60" height="140" rx="30" fill="url(#gradient)" opacity="0.3"/>
  
  <!-- Sound waves -->
  <path d="M140 200 Q120 180 120 200 Q120 220 140 200" stroke="white" stroke-width="8" fill="none" opacity="0.7"/>
  <path d="M120 200 Q90 160 90 200 Q90 240 120 200" stroke="white" stroke-width="8" fill="none" opacity="0.5"/>
  <path d="M100 200 Q60 140 60 200 Q60 260 100 200" stroke="white" stroke-width="8" fill="none" opacity="0.3"/>
  
  <path d="M372 200 Q392 180 392 200 Q392 220 372 200" stroke="white" stroke-width="8" fill="none" opacity="0.7"/>
  <path d="M392 200 Q422 160 422 200 Q422 240 392 200" stroke="white" stroke-width="8" fill="none" opacity="0.5"/>
  <path d="M412 200 Q452 140 452 200 Q452 260 412 200" stroke="white" stroke-width="8" fill="none" opacity="0.3"/>
  
  <!-- Microphone stand -->
  <rect x="246" y="300" width="20" height="60" fill="white" opacity="0.8"/>
  <rect x="216" y="360" width="80" height="20" rx="10" fill="white" opacity="0.8"/>
  
  <!-- AI indicator -->
  <circle cx="336" cy="160" r="16" fill="white" opacity="0.9"/>
  <text x="336" y="168" text-anchor="middle" fill="url(#gradient)" font-family="Arial" font-size="20" font-weight="bold">AI</text>
</svg>
`;

// Save the SVG
fs.writeFileSync(path.join(__dirname, 'public/icons/icon-base.svg'), iconSVG);

console.log('✅ Base SVG icon created');
console.log('📝 To generate PNG icons, you can use an online SVG to PNG converter or imagemagick:');
console.log('   convert icon-base.svg -resize 72x72 icon-72x72.png');
console.log('   convert icon-base.svg -resize 96x96 icon-96x96.png');
console.log('   convert icon-base.svg -resize 128x128 icon-128x128.png');
console.log('   convert icon-base.svg -resize 144x144 icon-144x144.png');
console.log('   convert icon-base.svg -resize 152x152 icon-152x152.png');
console.log('   convert icon-base.svg -resize 192x192 icon-192x192.png');
console.log('   convert icon-base.svg -resize 384x384 icon-384x384.png');
console.log('   convert icon-base.svg -resize 512x512 icon-512x512.png');