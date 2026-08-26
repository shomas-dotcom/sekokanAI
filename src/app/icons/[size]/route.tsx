import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";

// PWAのホーム画面アイコン用にPNGを動的生成する(next/ogはNext.js本体に同梱されており
// 追加の画像処理ライブラリを増やさずに済む)。既存のヘッダー・ログイン画面のロゴ
// ("現"の文字・アンバー〜オレンジのグラデーション)と見た目を揃えている。
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await params;
  const size = Number(sizeParam);
  if (!Number.isFinite(size) || size <= 0 || size > 1024) {
    return NextResponse.json({ error: "invalid size" }, { status: 400 });
  }

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
        <span
          style={{
            color: "white",
            fontSize: size * 0.55,
            fontWeight: 700,
          }}
        >
          現
        </span>
      </div>
    ),
    { width: size, height: size }
  );
}
