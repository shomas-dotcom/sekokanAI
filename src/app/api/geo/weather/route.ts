import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

// 天気取得: Open-Meteo(無料・APIキー不要 https://open-meteo.com/)を利用する。
// WMO Weather interpretation codesを、既存日報の入力に合わせた簡易な日本語表現
// (晴れ/曇り/雨/雪)へマッピングする。細かい状況までは断定せず、大区分のみ返す。
function weatherCodeToJapanese(code: number): string {
  if (code === 0 || code === 1) return "晴れ";
  if (code === 2 || code === 3 || (code >= 45 && code <= 48)) return "曇り";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "雪";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return "雨";
  return "不明";
}

export async function GET(request: Request) {
  await requireUser();

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat/lngが必要です。" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true`
    );
    if (!res.ok) return NextResponse.json({ weather: null });
    const data = (await res.json()) as { current_weather?: { weathercode: number } };
    const code = data.current_weather?.weathercode;
    if (code === undefined) return NextResponse.json({ weather: null });
    return NextResponse.json({ weather: weatherCodeToJapanese(code) });
  } catch {
    return NextResponse.json({ weather: null });
  }
}
