import type { NextConfig } from "next";

const isVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  // Use standalone only when not on Vercel (e.g. Docker VPS builds)
  ...(isVercel ? {} : { output: "standalone" }),
  serverExternalPackages: ["firebase-admin", "@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    '/**': ['./node_modules/.prisma/client/**/*', './prisma/**/*'],
  },
};

export default nextConfig;
