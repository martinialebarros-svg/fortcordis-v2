/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['216.238.116.77', 'localhost'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8001/api/v1/:path*',
      },
    ]
  },
}
module.exports = nextConfig
