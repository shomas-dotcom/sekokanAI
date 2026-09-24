// メール送信の抽象化レイヤー。RESEND_API_KEY未設定時はコンソール出力のみの
// モック実装で動作する(src/lib/ai/index.ts と同じ考え方)。
// 呼び出し側はこのモジュールの sendEmail のみを利用し、特定のメール送信サービスに
// 直接依存しないこと(将来サービスを乗り換える場合もここだけ直せばよいようにする)。

const isMockMode = () => !process.env.RESEND_API_KEY;

/** ログ用に宛先を伏せる(例: ta***@example.com)。本文やリンクと同様、個人情報を記録に残しすぎないため。 */
export function maskEmail(address: string): string {
  const [local, domain] = address.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  if (isMockMode()) {
    // 本文にはパスワード設定リンク等の認証情報が入るため、本番では本文をログに出さない。
    // 開発中だけは、メールサービスなしで動作確認できるよう本文も出す。
    if (process.env.NODE_ENV === "production") {
      console.warn(
        `[email:not-configured] メール送信設定(RESEND_API_KEY)がないため送信していません。to=${maskEmail(params.to)} subject=${params.subject}`
      );
      throw new Error("メール送信の設定がされていないため、メールを送れませんでした。");
    }
    console.log(`[email:mock] to=${params.to} subject=${params.subject}\n${params.text}`);
    return;
  }

  const fromAddress = process.env.EMAIL_FROM || "genba-ai@example.com";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!response.ok) {
    // 失敗を呼び出し元へ伝える。呼び出し元は try/catch で受け、会社登録等の本体処理は止めずに
    // 「メールを送れなかった」ことを画面やログで分かるようにする(成功と誤表示しないため)。
    console.error(`[email:error] status=${response.status} to=${maskEmail(params.to)}`);
    throw new Error(`メール送信に失敗しました(status=${response.status})`);
  }
}
