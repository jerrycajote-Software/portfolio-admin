/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Auth.js v5 beta imports "next/server" without the .js extension, which fails
  // when loaded as an external Node module from the Pages Router. Bundling it fixes that.
  transpilePackages: ["next-auth", "@auth/core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

module.exports = nextConfig;
