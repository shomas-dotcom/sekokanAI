import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function DisclaimerPage() {
  return (
    <LegalPageLayout title="免責事項">
      <section>
        <h2 className="font-semibold text-slate-900">書類の法的有効性について</h2>
        <p>
          本サービスで作成される工事請負契約書・見積書・請求書・施工計画書・安全書類等は一般的なひな形・下書きであり、法的有効性や法令適合性を保証するものではありません。個別の案件内容、取引条件、法令および発注者指定条件に応じて、行政書士・弁護士・税理士等の専門家に必ず確認してください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">損害についての免責</h2>
        <p>
          本サービスの利用または利用不能により生じた損害について、当社は法令上許容される範囲で責任を負わないものとします。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">情報の正確性</h2>
        <p>
          本サービスに表示される単価・計算結果・AIによる提案内容の正確性について万全を期していますが、完全性を保証するものではありません。
        </p>
      </section>
    </LegalPageLayout>
  );
}
