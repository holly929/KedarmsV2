/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fix for Firebase Studio / Cloud Workstations cross-origin request warnings
  // This allows the dev server to accept requests from the workstation proxy
  experimental: {
    allowedDevOrigins: [
      '6000-firebase-studio-1751138011272.cluster-l6vkdperq5ebaqo3qy4ksvoqom.cloudworkstations.dev',
      'localhost:9002'
    ],
  },
};

module.exports = nextConfig;
