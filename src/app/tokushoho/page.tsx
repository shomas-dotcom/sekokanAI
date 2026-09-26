import { LegalPageLayout } from "@/components/LegalPageLayout";

const ROWS: [string, string][] = [
  ["販売事業者名", "杉本土木株式会社"],
  ["運営責任者", "代表取締役 杉本将真"],
  ["所在地", "埼玉県所沢市泉町905-2"],
  ["連絡先", "メール: shoma.s@sugidoboku.com"],
  ["販売価格", "月額9,800円(税込)"],
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
