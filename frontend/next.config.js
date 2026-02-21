/** @type {import('next').NextConfig} */
// No servidor (stage/produção), defina API_BACKEND_URL (ex.: http://127.0.0.1:8001)
const apiBackend = process.env.API_BACKEND_URL || 'http://localhost:8000'
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBackend}/api/v1/:path*`,
      },
    ]
  },
}
module.exports = nextConfig
