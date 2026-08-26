import Link from "next/link";

const FEATURES = [
  { title: "AI音声日報", body: "現場の状況を話すだけで、日報の項目に自動で振り分け。内容は必ず確認してから保存します。" },
  { title: "AI見積・原価・粗利", body: "会社ごとの単価表をもとに見積の下書きを作成。粗利益・粗利率も自動で計算します。" },
  { title: "見積→契約→請求", body: "見積の金額をそのまま契約書・請求書へ引き継ぎ。入金確認まで一つの画面で管理できます。" },
  { title: "KY(危険予知)", body: "作業内容から危険ポイント・対策の候補を提案。現場責任者の確認・承認で確定します。" },
  { title: "従業員・資格管理", body: "資格の有効期限が近づくと警告。作業員名簿・資格一覧も自動で作成できます。" },
  { title: "施工計画書の下書き", body: "案件情報をもとに17章の下書きを作成。根拠のない内容は「要確認」と明示します。" },
];

const STEPS = [
  { title: "会社登録", body: "会社名・担当者名・メールアドレスを入力するだけ(1分)" },
  { title: "現場を登録", body: "工事名・発注者・工期などを入力(2分)" },
  { title: "AIに話す", body: "マイクボタンを押して、今日の作業内容を話すだけ" },
];

const FAQS = [
  {
    q: "パソコンが苦手でも使えますか?",
    a: "スマートフォンでの利用を前提に作っています。ボタンを押す・話す・確認するという操作が中心です。",
  },
  {
    q: "AIが単価や内容を勝手に決めてしまいませんか?",
    a: "いいえ。単価は会社ごとに登録した単価表を優先し、登録が無いものは金額を確定させず「単価不明」として残します。危険予知・施工計画書も同様に、AIの提案は必ず人の確認・承認を経てから確定します。",
  },
  {
    q: "無料体験の間にお金はかかりますか?",
    a: "現時点では会社登録・ログインは無料でお試しいただけます(お支払い情報の登録は不要です)。有料プランのお申し込み方法は今後ご案内します。",
  },
  {
    q: "今あるExcelの日報や見積のやり方を変える必要がありますか?",
    a: "既存の書式に近い形で日報・見積を作成できるよう作っています。まずは1つの現場から試していただくことをおすすめします。",
  },
];

export function LandingPage() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      {/* ヘッダー */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white">
              現
            </span>
            <span className="font-bold tracking-tight text-slate-900">現場AI</span>
          </div>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ログイン
          </Link>
        </div>
      </header>

      {/* メインコピー */}
      <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-white px-4 py-16 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          現場で喋るだけ。
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          日報・見積・請求・安全書類をAIで。
          <br />
          小さな建設会社の事務作業を、もっと簡単に。
        </p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500"
          >
            14日間無料で試す
          </Link>
          <p className="text-xs text-slate-400">お支払い情報の登録は不要です</p>
        </div>
      </section>

      {/* 課題 */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900">こんなお困りごとはありませんか?</h2>
        <div className="mt-6 grid gap-4 text-left sm:grid-cols-2">
          {[
            "現場から帰ってから日報や見積の入力に時間がかかる",
            "同じ現場情報を何度も入力し直している",
            "見積の金額に根拠がなく、粗利がどれくらい残るか分からない",
            "資格の有効期限管理がExcelで追いつかない",
          ].map((text) => (
            <div key={text} className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* 使い方 */}
      <section className="bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-slate-900">使い方</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-lg font-bold text-white">
                  {i + 1}
                </div>
                <p className="mt-3 font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 主要機能 */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900">主要機能</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 p-5">
              <p className="font-semibold text-slate-900">{f.title}</p>
              <p className="mt-2 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 料金 */}
      <section className="bg-slate-900 px-4 py-16 text-center text-white">
        <h2 className="text-2xl font-bold">料金</h2>
        <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8">
          <p className="text-sm text-slate-400">基本プラン</p>
          <p className="mt-2 text-4xl font-bold">
            9,800<span className="text-lg font-normal">円/月</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">(税込価格は別途表示・5ユーザーまで)</p>
          <p className="mt-4 text-sm text-slate-300">14日間無料体験あり</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900">よくある質問</h2>
        <div className="mt-8 flex flex-col gap-4">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-2xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">Q. {f.q}</p>
              <p className="mt-2 text-sm text-slate-600">A. {f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 無料体験CTA */}
      <section className="px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-slate-900">まずは1つの現場から試してみませんか</h2>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-600/25 transition hover:from-amber-400 hover:to-orange-500"
        >
          14日間無料で試す
        </Link>
      </section>

      {/* フッター */}
      <footer className="border-t border-slate-100 px-4 py-8 text-center text-xs text-slate-400">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
          <Link href="/terms" className="hover:text-slate-600">
            利用規約
          </Link>
          <Link href="/privacy" className="hover:text-slate-600">
            プライバシーポリシー
          </Link>
          <Link href="/tokushoho" className="hover:text-slate-600">
            特定商取引法に基づく表記
          </Link>
          <Link href="/ai-disclaimer" className="hover:text-slate-600">
            AI利用に関する注意
          </Link>
          <Link href="/disclaimer" className="hover:text-slate-600">
            免責事項
          </Link>
          <Link href="/contact" className="hover:text-slate-600">
            お問い合わせ
          </Link>
        </div>
        <p className="mt-4">現場AI</p>
      </footer>
    </div>
  );
}
