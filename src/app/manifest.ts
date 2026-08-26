import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "現場AI",
    short_name: "現場AI",
    description: "見積・日報・施工計画書の作成を、現場からスマホで。",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ea580c",
    lang: "ja",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
