"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuickState } from "@/lib/dailyReport/quickInput";

// 入力途中の内容を、この端末のブラウザ(localStorage)に残す。
// iPhoneは別のアプリに切り替えたり、写真を撮りに行ったりすると、ブラウザが画面を作り直して
// 入力が消えてしまうことがあるため。保存に成功したら、詳細画面側で消す(ClearQuickDraft)。
// 個人情報や単価は入らない(選んだ名前・数量・日付・メモだけ)。

export type QuickDraft = {
  projectId: string;
  reportDate: string;
  weather: string;
  memo: string;
  nextDayPlan: string;
  state: QuickState;
  savedAt: number;
};

export const DRAFT_PREFIX = "quickReportDraft:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function draftKey(mode: "create" | "edit", reportId?: string): string {
  return `${DRAFT_PREFIX}${mode === "edit" ? reportId : "new"}`;
}

function readDraft(key: string): QuickDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickDraft;
    if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useQuickDraft(key: string, current: Omit<QuickDraft, "savedAt">, hasContent: boolean) {
  const [saved, setSaved] = useState<QuickDraft | null>(null);
  const loaded = useRef(false);

  // 開いたとき(1回だけ)、前回の入力途中の内容があるか調べる。
  useEffect(() => {
    // localStorageはブラウザでしか読めないため、サーバーでの描画とそろえるために開いた後に調べる。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readDraft(key));
    loaded.current = true;
  }, [key]);

  // 入力のたびに(少し間をおいて)書き込む。何も入力されていなければ書かない。
  const serialized = JSON.stringify(current);
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      try {
        if (hasContent) {
          localStorage.setItem(key, JSON.stringify({ ...JSON.parse(serialized), savedAt: Date.now() }));
        }
      } catch {
        // 保存できない端末(プライベートブラウズ等)でも、入力そのものには支障がない
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [key, serialized, hasContent]);

  const discard = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      // 何もしない
    }
    setSaved(null);
  }, [key]);

  const dismiss = useCallback(() => setSaved(null), []);

  return { saved, discard, dismiss };
}
