/** @type {import('next').NextConfig} */
const API_BACKEND_URL = process.env.API_BACKEND_URL || 'http://localhost:8001'

const nextConfig = {
  allowedDevOrigins: ['216.238.116.77', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${API_BACKEND_URL}/api/v1/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
