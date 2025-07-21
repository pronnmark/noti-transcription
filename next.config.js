const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  reloadOnOnline: true,
  fallbacks: {
    image: '/static/images/fallback.png',
    document: '/offline',
  },
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure allowed dev origins for Next.js development
  allowedDevOrigins: ['noti.se', '*.noti.se', 'localhost:5173'],
  
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb'
    },
    // Enable experimental features for better development stability
    optimizePackageImports: ['@radix-ui/react-icons']
  },
  
  // Webpack configuration for better chunk loading
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Development-specific optimizations
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            },
            vendor: {
              test: /[\/]node_modules[\/]/,
              name: 'vendors',
              priority: -10,
              reuseExistingChunk: true
            }
          }
        }
      };
      
      // Add development middleware configuration
      config.devServer = {
        ...config.devServer,
        hot: true,
        liveReload: true,
        watchFiles: ['src/**/*']
      };
    }
    
    return config;
  },
  
  // Allow cross-origin requests and configure for reverse proxy
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'development' ? '*' : 'https://noti.se'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          }
        ]
      }
    ]
  },
  
  // Configure for reverse proxy environment
  trailingSlash: false,
  
  // Ensure proper hostname handling behind proxy
  async rewrites() {
    return []
  }
}

module.exports = withPWA(nextConfig)
