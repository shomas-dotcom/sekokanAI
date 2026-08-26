// GPS・天気取得のクライアント側ヘルパー(無料・APIキー不要の範囲のみ利用する。
// 実装の背景は src/app/api/geo/reverse/route.ts, src/app/api/geo/weather/route.ts 参照)。

export type GeoPosition = { latitude: number; longitude: number };

/** ブラウザの位置情報APIから現在地を取得する。取得できない場合はnullを返す(断定しない)。 */
export function getCurrentPosition(): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}

export async function reverseGeocode(pos: GeoPosition): Promise<string | null> {
  const res = await fetch(`/api/geo/reverse?lat=${pos.latitude}&lng=${pos.longitude}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { address: string | null };
  return data.address;
}

export async function fetchWeather(pos: GeoPosition): Promise<string | null> {
  const res = await fetch(`/api/geo/weather?lat=${pos.latitude}&lng=${pos.longitude}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { weather: string | null };
  return data.weather;
}
