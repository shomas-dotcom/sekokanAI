"use client";

import { useRef, useState } from "react";
import { getCurrentPosition, reverseGeocode, fetchWeather } from "@/lib/geo";

// GPSから現在地を取得し、現場住所(逆ジオコーディング)と天気をまとめて取得して
// フォームの隠しフィールドへ反映するボタン。取得できなかった項目は断定せず
// 空欄のままにする(既存の「音声から特定できない項目は空欄にする」方針と同じ)。
export function LocationWeatherButton({
  latitudeInputName = "latitude",
  longitudeInputName = "longitude",
  addressInputName = "capturedAddress",
  weatherInputName = "weatherAuto",
}: {
  latitudeInputName?: string;
  longitudeInputName?: string;
  addressInputName?: string;
  weatherInputName?: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const weatherRef = useRef<HTMLInputElement>(null);

  async function handleClick() {
    setStatus("loading");
    const pos = await getCurrentPosition();
    if (!pos) {
      setStatus("error");
      return;
    }
    if (latRef.current) latRef.current.value = String(pos.latitude);
    if (lngRef.current) lngRef.current.value = String(pos.longitude);

    const [addr, w] = await Promise.all([reverseGeocode(pos), fetchWeather(pos)]);
    setAddress(addr);
    setWeather(w);
    if (addressRef.current) addressRef.current.value = addr ?? "";
    if (weatherRef.current) weatherRef.current.value = w ?? "";
    setStatus("done");
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={latitudeInputName} ref={latRef} />
      <input type="hidden" name={longitudeInputName} ref={lngRef} />
      <input type="hidden" name={addressInputName} ref={addressRef} />
      <input type="hidden" name={weatherInputName} ref={weatherRef} />
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-100 disabled:opacity-50"
      >
        📍 {status === "loading" ? "取得中..." : "現在地から住所・天気を取得"}
      </button>
      {status === "done" && (
        <p className="text-xs text-slate-500">
          住所: {address ?? "取得できませんでした"} / 天気: {weather ?? "取得できませんでした"}
        </p>
      )}
      {status === "error" && (
        <p className="text-xs text-rose-600">位置情報を取得できませんでした。端末の位置情報設定をご確認ください。</p>
      )}
    </div>
  );
}
