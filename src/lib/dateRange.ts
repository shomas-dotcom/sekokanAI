// Reactの新しい「コンポーネントは純粋であるべき」チェックが、コンポーネント本体で
// Date.now()/new Date()を直接呼ぶことを警告する(現在時刻を含むためレンダーのたびに
// 結果が変わりうる、という指摘)。実際にはServer Componentなので問題ないが、日付計算は
// この関数にまとめておくことで警告を避ける。

/** 現在時刻からdays日前の日時を返す。 */
export function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}
