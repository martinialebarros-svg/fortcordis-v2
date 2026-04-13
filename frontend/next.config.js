/** @type {import('next').NextConfig} */
// No servidor (stage/producao), defina API_BACKEND_URL (ex.: http://127.0.0.1:8000)
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
const path = require("path")
const apiBackend = process.env.API_BACKEND_URL || 'http://127.0.0.1:8000'
const whatsappStageBackend = process.env.WHATSAPP_STAGE_BACKEND_URL

const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),
  async rewrites() {
    const rewrites = [
      {
        source: '/api/v1/:path*',
        destination: `${apiBackend}/api/v1/:path*`,
      },
    ]

    if (whatsappStageBackend) {
      rewrites.push(
        {
          source: '/whatsapp',
          destination: `${whatsappStageBackend}/health`,
        },
        {
          source: '/whatsapp/:path*',
          destination: `${whatsappStageBackend}/:path*`,
        }
      )
    }

    return rewrites
  },
}

module.exports = withBundleAnalyzer(nextConfig)
