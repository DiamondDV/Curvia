/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  webpack: (config) => {
    // Sharp uses prebuilt native bindings — keep it external to the bundle
    config.externals = [...(config.externals || []), 'sharp'];
    return config;
  },
};

module.exports = nextConfig;
