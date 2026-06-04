// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//   images: { domains: ['localhost'] },
//   env: {
//     NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
//   },
// };
// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  reactStrictMode: true,

  images: {
    domains: ['localhost'],
  },

  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  },
};

module.exports = nextConfig;
