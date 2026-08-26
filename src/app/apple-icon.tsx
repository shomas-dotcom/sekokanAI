import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
        }}
      >
        <span style={{ color: "white", fontSize: 100, fontWeight: 700 }}>現</span>
      </div>
    ),
    { ...size }
  );
}
