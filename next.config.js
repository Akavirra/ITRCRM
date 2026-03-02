/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        source: '/api/notifications/telegram',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-transform, must-revalidate' }
        ]
      },
      {
        source: '/api/notifications/telegram/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-transform, must-revalidate' }
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'" + (isDev ? " 'unsafe-eval'" : ""),
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://res.cloudinary.com",
              "connect-src 'self' https://*.neon.tech",
              "font-src 'self' data:",
            ].join('; ')
          }
        ]
      }
    ];
  },
}

module.exports = nextConfig
