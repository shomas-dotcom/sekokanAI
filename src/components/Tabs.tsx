"use client";

import { useState } from "react";

/**
 * 詳細画面を「基本情報」「ファイル参照」等のタブに分ける汎用コンポーネント。
 * 各タブの中身はServer Componentのままでよい(Client Componentへのchildrenとしての
 * 受け渡しはNext.jsのApp Routerで許可されている)。切り替えは表示/非表示のみで、
 * 中身自体は最初から全てレンダリングしておく(タブ切替のたびに再取得しない)。
 */
export function Tabs({
  tabs,
  initialActive = 0,
}: {
  tabs: { label: string; content: React.ReactNode }[];
  /** 他の画面から引き継いだ内容がある場合等、最初に開くタブを指定する(既定は先頭) */
  initialActive?: number;
}) {
  const [active, setActive] = useState(initialActive);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(i)}
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
