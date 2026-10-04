import type { NextConfig } from "next";

const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // Use standalone only when not on Vercel (e.g. Docker VPS builds)
  ...(isVercel ? {} : { output: "standalone" }),
  serverExternalPackages: ["firebase-admin", "@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/.prisma/client/**/*', './prisma/**/*'],
  },
  async redirects() {
    return [
      {
        source: '/privacy',
        destination: '/privacy-policy',
        permanent: true,
      },
      {
        source: '/terms',
        destination: '/terms-and-conditions',
        permanent: true,
      },
      {
        source: '/terms-of-service',
        destination: '/terms-and-conditions',
        permanent: true,
      },
      {
        source: '/refund',
        destination: '/refund-policy',
        permanent: true,
      },
      {
        source: '/cancellation',
        destination: '/refund-policy',
        permanent: true,
      },
      {
        source: '/cancellation-policy',
        destination: '/refund-policy',
        permanent: true,
      },
      {
        source: '/cancellation-refund-policy',
        destination: '/refund-policy',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
