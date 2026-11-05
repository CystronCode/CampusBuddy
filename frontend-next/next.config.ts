import type { NextConfig } from "next";

const config: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() {
    const backend = (
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");
    return [
      {
        source: "/v1/:path*",
        destination: `${backend}/v1/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default config;
