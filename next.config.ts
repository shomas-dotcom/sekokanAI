import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't pick up an
  // unrelated package-lock.json further up the filesystem tree.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
