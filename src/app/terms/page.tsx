import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="利用規約">
      <p>
        本規約は、現場AI(以下「本サービス」といいます)の利用条件を定めるものです。ご利用にあたっては本規約に同意いただく必要があります。
      </p>
      <section>
        <h2 className="font-semibold text-slate-900">第1条(適用)</h2>
        <p>本規約は、本サービスの利用に関わる一切の関係に適用されます。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第2条(アカウント登録)</h2>
        <p>
          利用者は、真実かつ正確な情報を登録するものとします。登録情報に虚偽があった場合、当社は利用停止等の措置を取ることがあります。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第3条(禁止事項)</h2>
        <p>
          法令または公序良俗に違反する行為、他の利用者・第三者の権利を侵害する行為、本サービスの運営を妨げる行為を禁止します。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第4条(料金・お支払い)</h2>
        <p>
          有料プランの料金・お支払い方法は別途定める料金ページのとおりとします。無料体験期間・解約・返金の取り扱いについても別途案内します。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第5条(利用停止・解約)</h2>
        <p>
          利用者が本規約に違反した場合、当社は事前の通知なく利用を停止できるものとします。利用者はいつでも解約を申し出ることができます。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第6条(免責事項)</h2>
        <p>
          本サービスが生成する見積・日報・施工計画書・安全書類等の内容について、当社はその正確性・完全性・法令適合性を保証しません。最終確認・判断は利用者の責任で行うものとします。詳細は
          <a href="/disclaimer" className="text-orange-700 underline">
            免責事項
          </a>
          をご確認ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第7条(規約の変更)</h2>
        <p>当社は必要と判断した場合、利用者への通知のうえ本規約を変更することがあります。</p>
      </section>
      <p className="text-xs text-slate-400">制定日: 仮(専門家レビュー前)</p>
    </LegalPageLayout>
  );
}
