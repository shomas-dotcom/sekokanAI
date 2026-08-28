"use client";

import { useState } from "react";

/**
 * 詳細画面を「基本情報」「ファイル参照」等のタブに分ける汎用コンポーネント。
 * 各タブの中身はServer Componentのままでよい(Client Componentへのchildrenとしての
 * 受け渡しはNext.jsのApp Routerで許可されている)。切り替えは表示/非表示のみで、
 * 中身自体は最初から全てレンダリングしておく(タブ切替のたびに再取得しない)。
 */
export function Tabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);

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
