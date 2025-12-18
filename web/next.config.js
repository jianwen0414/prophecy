/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Fix for pino-pretty and other Node.js modules in browser bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve these modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        'pino-pretty': false,
      };
    }

    // Externalize pino-related packages
    config.externals = config.externals || [];
    config.externals.push({
      'pino-pretty': 'pino-pretty',
    });

    return config;
  },
};

module.exports = nextConfig;
