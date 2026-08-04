export type PremiumFeature = {
  key: string;
  title: string;
  description: string;
  benefit: string;
  timeSaved: string;
  href: string | null; // 実装済みの場合のみ遷移先を設定
};

// 優先度: 既に実装済みの2機能 + 事業者要望リストの残り10機能(未実装、近日提供)。
// REQUIREMENTS.md/PROJECT_PLAN.mdの将来ロードマップに対応。
export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    key: "quote",
    title: "AI見積書作成",
    description: "工事内容を自由記述または音声で入力すると、見積項目の下書きを自動作成します。",
    benefit: "単価は必ず出所(会社登録/過去実績/参考/AI推定/手動)を明示し、AIが単価を勝手に確定しません。",
    timeSaved: "見積書1件あたり作成時間を目安30分→10分に短縮",
    href: "/quotes/new",
  },
  {
    key: "constructionPlan",
    title: "AI施工計画書作成",
    description: "工事概要から施工フローまで17章の下書きテンプレートを自動生成します。",
    benefit: "不足情報・推測箇所を明示し、全章確認済みになるまで提出可能にしない安全設計です。",
    timeSaved: "章立て作成の手間を削減(内容そのものの精度は人間の確認が前提)",
    href: "/construction-plans/new",
  },
  {
    key: "roadUsePermit",
    title: "AI道路使用許可申請書作成",
    description: "工事マスターの情報から道路使用許可申請書の下書きを作成します。",
    benefit: "同じ現場情報を何度も入力する必要がなくなります。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "roadOccupancyPermit",
    title: "AI道路占用許可申請書作成",
    description: "道路占用許可申請書の下書きを作成します。",
    benefit: "自治体ごとの様式差分にも将来対応予定です。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "orgLedger",
    title: "AI施工体制台帳",
    description: "施工体制台帳の下書きを自動作成します。",
    benefit: "案件・作業員データと連携し二重入力をなくします。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "subcontractNotice",
    title: "AI再下請通知書",
    description: "再下請負通知書の下書きを作成します。",
    benefit: "施工体制台帳と連動した一貫性のある書類作成を予定しています。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "safetyDocs",
    title: "AI安全書類一式",
    description: "安全書類一式(グリーンファイル等)の下書きを作成します。",
    benefit: "案件・作業員・重機データを再利用し入力の手間を減らします。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "quantityCalc",
    title: "AI数量計算",
    description: "図面・数量表をもとに数量計算の下書きを作成します。",
    benefit: "根拠のない数値は断定せず、確認が必要な箇所を明示します。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "estimation",
    title: "AI積算",
    description: "数量計算結果をもとに積算(原価積み上げ)の下書きを作成します。",
    benefit: "AI見積書作成と連携し二重入力をなくす予定です。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "scheduleCreation",
    title: "AI工程作成",
    description: "案件情報から工程表の下書きを作成します。",
    benefit: "無料機能の工程表と連携予定です。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "riskAnalysis",
    title: "AIリスク分析",
    description: "案件・現場条件からリスク分析の下書きを作成します。",
    benefit: "安全書類・施工計画書と連携予定です。",
    timeSaved: "近日提供",
    href: null,
  },
  {
    key: "municipalDocs",
    title: "自治体ごとの提出書類自動作成",
    description: "発注者(自治体)ごとのテンプレートに合わせた提出書類を作成します。",
    benefit: "会社別・発注者別テンプレート機能(Template)を拡張して対応予定です。",
    timeSaved: "近日提供",
    href: null,
  },
];
