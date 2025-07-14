/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure allowed dev origins for Next.js development
  allowedDevOrigins: ['noti.se', '*.noti.se', 'localhost:5173'],
  
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb'
    }
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
