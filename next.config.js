/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/umami/script.js',
        destination: 'https://umamilab.ngrok.dev/script.js',
      },
      {
        source: '/umami/:path*',
        destination: 'https://umamilab.ngrok.dev/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
