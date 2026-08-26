import { LegalPageLayout } from "@/components/LegalPageLayout";

const ROWS: [string, string][] = [
  ["販売事業者名", "仮(専門家レビュー前・登記名称を記載してください)"],
  ["運営責任者", "仮"],
  ["所在地", "仮(ご請求があれば遅滞なく開示します、とする場合は別途規定が必要)"],
  ["連絡先", "お問い合わせページよりご連絡ください"],
  ["販売価格", "月額9,800円(税込表示は法令に合わせて別途確定)"],
  ["支払方法", "クレジットカード決済(予定)"],
  ["支払時期", "初回無料体験終了後、毎月自動更新"],
  ["提供時期", "お申し込み後、即時ご利用いただけます"],
  ["返品・キャンセル", "サービスの性質上、原則として返金は行いません(詳細は仮)"],
];

export default function TokushohoPage() {
  return (
    <LegalPageLayout title="特定商取引法に基づく表記">
      <p>特定商取引法第11条に基づき、以下のとおり表示します。</p>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {ROWS.map(([label, value]) => (
            <tr key={label} className="border-b border-slate-200 align-top">
              <th className="w-40 py-2 pr-4 text-left font-medium text-slate-500">{label}</th>
              <td className="py-2 text-slate-700">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </LegalPageLayout>
  );
}
