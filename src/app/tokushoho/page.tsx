import { LegalPageLayout } from "@/components/LegalPageLayout";

const ROWS: [string, string][] = [
  ["販売事業者名", "杉本土木株式会社"],
  ["運営責任者", "代表取締役 杉本将真"],
  ["所在地", "埼玉県所沢市泉町905-2"],
  ["電話番号", "04-2930-8299(FAX同番号)"],
  ["メールアドレス", "shoma.s@sugidoboku.com"],
  ["販売価格", "月額9,800円(税込)"],
  ["商品代金以外の必要料金", "インターネット接続にかかる通信料はお客様のご負担となります"],
  ["支払方法", "クレジットカード決済"],
  ["支払時期", "14日間の無料体験終了時に初回のお支払い、以後1か月ごとに自動更新"],
  ["提供時期", "お申し込み後、即時ご利用いただけます"],
  [
    "解約・返金",
    "「ご契約」画面からいつでも解約できます。解約後も、その請求期間の終わりまでご利用いただけます。日割りでの返金は行いません",
  ],
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
