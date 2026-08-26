import { LegalPageLayout } from "@/components/LegalPageLayout";

export default function AiDisclaimerPage() {
  return (
    <LegalPageLayout title="AI利用に関する注意">
      <section>
        <h2 className="font-semibold text-slate-900">AIが確定させない範囲</h2>
        <p>
          本サービスのAI機能は、見積の単価・危険予知(KY)の内容・施工計画書の記述について、下書き・候補の提案のみを行います。会社が単価表に登録していない項目は金額を確定させず「単価不明」として残し、KY・施工計画書の内容は現場責任者・施工管理者の確認・修正・承認を経るまで確定しません。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">断定・捏造をしない設計</h2>
        <p>
          安全確認・点検結果等について、確認できていない事項を「良好」「異常なし」等と自動的に作成することはありません。根拠が確認できない情報には「要確認」と表示します。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">個人情報・機微情報の扱い</h2>
        <p>
          氏名・資格情報等の個人情報、マイナンバー・健康情報・銀行情報等の機微情報は、AI(外部API)へ送信しない設計としています。
        </p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-900">最終確認の必要性</h2>
        <p>
          AIが作成した内容は、必ず利用者(現場責任者・施工管理者等)が確認したうえでご利用ください。法令・仕様書・基準値等への適合性を当社が保証するものではありません。
        </p>
      </section>
    </LegalPageLayout>
  );
}
