import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="プライバシーポリシー">
      <p>
        現場AI(以下「本サービス」といいます)における個人情報の取り扱いについて、以下のとおり定めます。
      </p>
      <section>
        <h2 className="font-semibold text-slate-900">1. 取得する情報</h2>
        <p>
          会社名・氏名・メールアドレス・電話番号・住所等、利用者が本サービスに登録する情報を取得します。マイナンバー・健康診断情報・銀行口座情報・身分証明書等の機微情報は、業務上必要な範囲に限り利用者の責任で登録するものとし、当社が積極的に収集することはありません。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">2. AIへの情報送信について</h2>
        <p>
          本サービスのAI機能は、業務に必要な範囲の情報のみを処理します。氏名・資格情報等の個人情報や、機微情報(マイナンバー・健康情報・銀行情報等)は、AI(外部API)へ送信しない設計としています。詳細は
          <a href="/ai-disclaimer" className="text-orange-700 underline">
            AI利用に関する注意
          </a>
          をご確認ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">3. 利用目的</h2>
        <p>本サービスの提供・維持・改善、利用者への連絡、料金請求のために利用します。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">4. 第三者提供</h2>
        <p>法令に基づく場合を除き、利用者の同意なく個人情報を第三者へ提供しません。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">5. 委託先</h2>
        <p>
          決済処理・メール送信等、サービス提供に必要な範囲で外部事業者に処理を委託することがあります。委託先には適切な監督を行います。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">6. データの保存・削除</h2>
        <p>
          退会時のデータの取り扱いについては、アカウント画面の案内に従います。会社全体のデータ削除をご希望の場合は、お問い合わせ窓口までご連絡ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">7. お問い合わせ</h2>
        <p>
          個人情報の取り扱いに関するお問い合わせは
          <a href="/contact" className="text-orange-700 underline">
            お問い合わせページ
          </a>
          からご連絡ください。
        </p>
      </section>
      <p className="text-xs text-slate-400">制定日: 仮(専門家レビュー前)</p>
    </LegalPageLayout>
  );
}
