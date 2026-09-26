import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="プライバシーポリシー">
      <p>
        杉本土木株式会社(以下「当社」といいます)は、現場AI(以下「本サービス」といいます)における個人情報の取り扱いについて、以下のとおり定めます。
      </p>
      <section>
        <h2 className="font-semibold text-slate-900">1. 事業者</h2>
        <p>杉本土木株式会社　代表取締役 杉本将真　埼玉県所沢市泉町905-2</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">2. 取得する情報</h2>
        <p>
          会社名・氏名・メールアドレス・電話番号・住所等、利用者が本サービスに登録する情報のほか、利用者が入力・撮影・録音した日報・写真・音声・書類の内容を取得します。マイナンバー・健康診断情報・銀行口座情報・身分証明書等の機微情報は、業務上必要な範囲に限り利用者の責任で登録するものとし、当社が積極的に収集することはありません。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">3. 利用目的</h2>
        <p>本サービスの提供・維持・改善、利用者への連絡、料金請求のために利用します。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">4. AIへの情報送信について</h2>
        <p>
          利用者がAIによる読み取り・下書き作成を指示した場合(名刺・注文書・見積書・伝票の読み取り、音声日報の整理、見積・施工計画書・KYの下書き等)、その書類・画像・文章の内容は、そこに含まれる氏名・連絡先等も含めて、AIの処理のために外部のAI事業者(下記6.)へ送信されます。マイナンバー・健康情報・銀行口座情報等の機微情報を含む書類は、AIによる読み取りに使わないでください。詳細は
          <a href="/ai-disclaimer" className="text-orange-700 underline">
            AI利用に関する注意
          </a>
          をご確認ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">5. 第三者提供</h2>
        <p>法令に基づく場合を除き、利用者の同意なく個人情報を第三者へ提供しません。</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">6. 委託先と外国での取り扱い</h2>
        <p>
          サービス提供に必要な範囲で、次の外部事業者に処理を委託しています。これらの事業者は外国(米国・シンガポール)にあり、データが外国で保存・処理されます。各国の個人情報保護制度は、個人情報保護委員会のウェブサイトで確認できます。当社は委託先の選定と監督を適切に行います。
        </p>
        <ul className="list-disc pl-5">
          <li>サーバーの運用: Render(米国)</li>
          <li>データベースの保管: Neon(保管場所 シンガポール)</li>
          <li>AIによる読み取り・下書き作成: Anthropic(米国)</li>
          <li>クレジットカード決済: Stripe(米国)。カード番号は当社のサーバーには保存しません</li>
          <li>メール送信: Resend(米国)</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">7. 安全管理のための措置</h2>
        <p>
          通信の暗号化、パスワードの暗号化保存、会社ごとのデータの分離、操作記録の保存、ログイン失敗の回数制限等により、個人情報の漏えい等を防ぎます。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">8. データの保存・削除</h2>
        <p>
          退会時のデータの取り扱いについては、アカウント画面の案内に従います。会社全体のデータ削除をご希望の場合は、お問い合わせ窓口までご連絡ください。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">9. 開示等のご請求・お問い合わせ</h2>
        <p>
          保有する個人情報の開示・訂正・利用停止・削除のご請求、その他個人情報の取り扱いに関するお問い合わせは
          <a href="/contact" className="text-orange-700 underline">
            お問い合わせページ
          </a>
          の連絡先までご連絡ください。ご本人であることを確認のうえ対応します。
        </p>
      </section>
      <p className="text-xs text-slate-400">制定日: 2026年9月26日</p>
    </LegalPageLayout>
  );
}
