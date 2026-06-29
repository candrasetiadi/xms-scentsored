import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gambar eksternal (jika ada upload ke Supabase Storage)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kpiiibfqlqitjfhgywio.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
