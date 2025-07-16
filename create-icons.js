const fs = require('fs');
const path = require('path');

// Create a simple base64 encoded PNG icon (purple microphone)
const createIcon = (size) => {
  // This is a simple 1x1 purple pixel, but for production you'd want proper icons
  const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#7C3AED" rx="${size/8}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size/4}" fill="white" opacity="0.9"/>
      <text x="${size/2}" y="${size/2 + size/20}" text-anchor="middle" fill="#7C3AED" font-family="Arial" font-size="${size/8}" font-weight="bold">N</text>
    </svg>
  `;
  
  return canvas;
};

// Create icons for all required sizes
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = createIcon(size);
  fs.writeFileSync(path.join(__dirname, `public/icons/icon-${size}x${size}.svg`), svg);
});

console.log('✅ SVG icons created for all sizes');
console.log('📱 These will work as fallbacks for the PWA');
console.log('🎨 For production, consider creating proper PNG icons from the SVG files');