import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Let the root-served SW control the /admin scope, and never
        // let a stale worker stick around.
        source: "/admin-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/admin" },
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "text/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
