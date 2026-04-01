/** @type {import('next').NextConfig} */
// No servidor (stage/producao), defina API_BACKEND_URL (ex.: http://127.0.0.1:8000)
const apiBackend = process.env.API_BACKEND_URL || 'http://127.0.0.1:8000'

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
