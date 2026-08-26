import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't pick up an
  // unrelated package-lock.json further up the filesystem tree.
  turbopack: {
    root: path.join(__dirname),
  },
  // OWASPの一般的な推奨に沿った基本的なセキュリティヘッダー(SECURITY.md)。
  // HTTPS化(Strict-Transport-Security)はデプロイ先のTLS終端が前提のため、
  // ここではアプリ側で安全に設定できるヘッダーのみを付与する。
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
