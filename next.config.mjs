/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongodb', 'bcryptjs'],
  devIndicators: false,
  skipProxyUrlNormalize: true,
};

export default nextConfig;
