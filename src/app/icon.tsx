import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <span style={{ color: "white", fontSize: 20, fontWeight: 700 }}>現</span>
      </div>
    ),
    { ...size }
  );
}
