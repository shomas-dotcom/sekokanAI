import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="利用規約">
      <p>
        本規約は、杉本土木株式会社(以下「当社」といいます)が提供する現場AI(以下「本サービス」といいます)の利用条件を定めるものです。ご利用にあたっては本規約に同意いただく必要があります。
      </p>
      <section>
        <h2 className="font-semibold text-slate-900">第1条(適用)</h2>
        <p>本規約は、本サービスの利用に関わる一切の関係に適用されます。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第2条(アカウント登録)</h2>
        <p>
          利用者は、真実かつ正確な情報を登録するものとします。登録情報に虚偽があった場合、当社は利用停止等の措置を取ることがあります。利用者は、ログインに使うメールアドレス・パスワードを自らの責任で管理するものとします。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第3条(禁止事項)</h2>
        <p>
          法令または公序良俗に違反する行為、他の利用者・第三者の権利を侵害する行為、本サービスの運営を妨げる行為、不正にアクセスする行為を禁止します。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第4条(料金・お支払い)</h2>
        <p>
          有料プランの料金は月額9,800円(税込)です。お支払いはクレジットカードによるものとします。お申し込みから14日間は無料体験期間とし、期間中に解約しない場合は、期間の終了時から有料となり、以後1か月ごとに自動で更新・請求されます。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第5条(解約・返金)</h2>
        <p>
          利用者は「ご契約」画面からいつでも解約できます。解約した場合も、その時点の請求期間の終わりまでは本サービスを利用でき、次の請求は発生しません。月の途中で解約された場合も、日割りでの返金は行いません。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第6条(利用停止)</h2>
        <p>
          利用者が本規約に違反した場合、または料金のお支払いが確認できない場合、当社は事前の通知なく利用を停止できるものとします。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第7条(免責事項)</h2>
        <p>
          本サービスが生成する見積・日報・施工計画書・安全書類等の内容について、当社はその正確性・完全性・法令適合性を保証しません。最終確認・判断は利用者の責任で行うものとします。詳細は
          <a href="/disclaimer" className="text-orange-700 underline">
            免責事項
          </a>
          をご確認ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第8条(損害賠償の上限)</h2>
        <p>
          本サービスに関して当社が利用者に損害賠償責任を負う場合、当社に故意または重大な過失がある場合を除き、その額は、損害が発生した月の前月に利用者が当社に支払った利用料金の額を上限とします。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第9条(反社会的勢力の排除)</h2>
        <p>
          利用者は、自らが暴力団その他の反社会的勢力に該当しないこと、今後も該当しないことを約束するものとします。これに反した場合、当社は直ちに利用を停止できるものとします。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第10条(規約の変更)</h2>
        <p>当社は必要と判断した場合、利用者への通知のうえ本規約を変更することがあります。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">第11条(準拠法・管轄裁判所)</h2>
        <p>
          本規約は日本法に従って解釈されます。本サービスに関して紛争が生じた場合は、さいたま地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </section>
      <p className="text-xs text-slate-400">制定日: 2026年9月26日</p>
    </LegalPageLayout>
  );
}
