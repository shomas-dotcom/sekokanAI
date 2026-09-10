import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't pick up an
  // unrelated package-lock.json further up the filesystem tree.
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Server Action(名刺OCR・身分証OCR・案件依頼解析・AIかんたん登録・写真/資料添付・
    // 日報の写真アップロード等)へファイルを送る処理で、既定の1MB上限だと
    // スマホの写真(2〜5MB)がサーバーに届かず「Body exceeded 1 MB limit」で
    // 弾かれる。アプリ側のファイル検証(fileValidation.ts)は最大20MBを許可して
    // いるため、multipartのオーバーヘッド込みで25MBまで受け付ける。
    serverActions: {
      bodySizeLimit: "25mb",
    },
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
          // camera=(self): 名刺・身分証・図面の撮影機能で自サイトのカメラ利用を許可する
          // (camera=() だと自サイトのカメラまで塞がれ、撮影・写真添付ができなくなる)。
          // 第三者のiframe埋め込みからは引き続き禁止。
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
