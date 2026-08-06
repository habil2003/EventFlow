import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ✅ Your existing allowed origins - keep these
  allowedDevOrigins: [
    'localhost',
    '192.168.1.*',
    '192.168.100.*',
    '*.local',
    '*.ngrok.io',
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
  ],
  
  // ✅ Images configuration
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
        hostname: '*.ngrok.io',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok-free.app',
      },
      {
        protocol: 'https',
        hostname: '*.ngrok-free.dev',
      },
      {
        protocol: 'http',
        hostname: '*.ngrok.io',
      },
      {
        protocol: 'http',
        hostname: '*.ngrok-free.app',
      },
      {
        protocol: 'http',
        hostname: '*.ngrok-free.dev',
      },
      // ✅ Add UploadThing domains
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: '*.ufs.sh',
      },
      {
        protocol: 'https',
        hostname: '*.uploadthing.com',
      },
    ],
  },
  
  // ✅ Removed output: 'standalone' - using default
  // output: 'standalone', // Commented out
  
  // ✅ Experimental features
  experimental: {
    optimizePackageImports: ['@heroicons/react', 'framer-motion'],
  },
  
  // ✅ Headers for camera access, security, and ngrok warning skip
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // ✅ Skip ngrok browser warning page
          {
            key: 'ngrok-skip-browser-warning',
            value: 'true',
          },
          // Allow camera access
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          // ✅ FIX: Change COEP from 'require-corp' to 'credentialless'
          // This allows cross-origin resources like UploadThing images
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
          // Allow ngrok origins
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};

export default nextConfig;