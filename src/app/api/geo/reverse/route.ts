import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

// 逆ジオコーディング: Nominatim(OpenStreetMap、無料・APIキー不要)を利用する。
// 利用規約(https://operations.osmfoundation.org/policies/nominatim/)により
// User-Agent必須・1リクエスト/秒程度の軽量利用に限る。杉本土木の日報作成頻度
// (1日あたり数件)では問題ないが、将来他社へ大量販売する場合は有料ジオコーディング
// サービスへの切替を要する([no-billing-without-confirmation]、要ユーザー確認)。
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
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=ja`,
      { headers: { "User-Agent": "genba-ai/1.0 (construction daily report app)" } }
    );
    if (!res.ok) return NextResponse.json({ address: null });
    const data = (await res.json()) as { display_name?: string };
    return NextResponse.json({ address: data.display_name ?? null });
  } catch {
    // 外部API失敗時は断定せずnullを返す(呼び出し側で「取得できませんでした」と表示する)
    return NextResponse.json({ address: null });
  }
}
