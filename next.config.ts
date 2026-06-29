import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Your existing allowed origins - keep these
  allowedDevOrigins: [
    'localhost',
    '192.168.1.*',
    '192.168.100.*',
    '*.local',
    '*.ngrok.io', // ✅ Added ngrok support
  ],
  
  // ✅ Fix: Use remotePatterns instead of deprecated domains
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
      },
      {
        protocol: 'http',
        hostname: '192.168.100.*',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok.io', // ✅ For HTTPS tunneling
      },
    ],
  },
  
  // ✅ REMOVED: The 'server' key is not valid in next.config.ts
  // HTTPS is handled differently in Next.js 16+
  
  // ✅ Keep this
  output: 'standalone',
  
  // ✅ Add this for better development experience
  experimental: {
    // Enable faster refresh
    optimizePackageImports: ['@heroicons/react', 'framer-motion'],
  },
  
  // ✅ Add this to handle CORS during development
  async headers() {
    return [
      {
        // Allow camera access from any origin during development
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;