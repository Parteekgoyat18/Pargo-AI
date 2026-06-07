/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongodb', 'bcryptjs'],
  devIndicators: false,
};

export default nextConfig;
