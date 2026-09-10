"use client";

import { useEffect, useState } from "react";

/**
 * 詳細画面を「基本情報」「ファイル参照」等のタブに分ける汎用コンポーネント。
 * 各タブの中身はServer Componentのままでよい(Client Componentへのchildrenとしての
 * 受け渡しはNext.jsのApp Routerで許可されている)。切り替えは表示/非表示のみで、
 * 中身自体は最初から全てレンダリングしておく(タブ切替のたびに再取得しない)。
 */
export function Tabs({
  tabs,
  initialActive = 0,
  persistKey,
}: {
  tabs: { label: string; content: React.ReactNode }[];
  /** 他の画面から引き継いだ内容がある場合等、最初に開くタブを指定する(既定は先頭) */
  initialActive?: number;
  /**
   * 指定すると、選択中のタブをこのキーでsessionStorageに保存する。
   * iPhone Safariはカメラ・写真選択を開くとページを一旦破棄することがあり、
   * 戻ってきたときにタブ選択が失われて「前の画面に戻った」ように見える。
   * これを指定しておくと、ページが再読み込みされても元のタブに復帰できる。
   */
  persistKey?: string;
}) {
  const [active, setActive] = useState(initialActive);

  // マウント後にsessionStorageから復元する(SSRと初回描画を一致させ、ハイドレーション
  // 不整合を避けるため、ここでの復元は初回描画後に行う)。
  useEffect(() => {
    if (!persistKey) return;
    // 呼び出し側が明示的に特定タブを指定している場合(例: 「AIに話す」から音声タブへ
    // 引き継いだ場合)は、そちらを優先し、保存値での復元はしない。
    if (initialActive !== 0) return;
    try {
      const saved = sessionStorage.getItem(`tabs:${persistKey}`);
      if (saved !== null) {
        const n = Number(saved);
        if (Number.isInteger(n) && n >= 0 && n < tabs.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setActive(n);
        }
      }
    } catch {
      // プライベートブラウズ等でsessionStorageが使えない場合は何もしない
    }
  }, [persistKey, tabs.length, initialActive]);

  function selectTab(i: number) {
    setActive(i);
    if (persistKey) {
      try {
        sessionStorage.setItem(`tabs:${persistKey}`, String(i));
      } catch {
        // 保存できなくても動作に支障はない
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => selectTab(i)}
            className={`px-4 py-2 text-sm font-medium transition ${
              active === i
                ? "border-b-2 border-amber-600 text-amber-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.label} className={active === i ? "" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
