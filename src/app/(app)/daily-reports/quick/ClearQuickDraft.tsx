"use client";

import { useEffect } from "react";
import { DRAFT_PREFIX } from "./useQuickDraft";

/**
 * 保存が成功して詳細画面に戻ったとき、その日報(と新規作成)の入力途中の内容を消す。
 * 保存に失敗したときは、この画面には来ないので、入力途中の内容は残ったままになる。
 */
export function ClearQuickDraft({ reportId }: { reportId: string }) {
  useEffect(() => {
    try {
      localStorage.removeItem(`${DRAFT_PREFIX}new`);
      localStorage.removeItem(`${DRAFT_PREFIX}${reportId}`);
    } catch {
      // 何もしない
    }
  }, [reportId]);
  return null;
}
