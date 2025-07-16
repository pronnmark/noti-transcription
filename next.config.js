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
  
  // Allow cross-origin requests from noti.se domain
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
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
