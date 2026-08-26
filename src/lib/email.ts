// メール送信の抽象化レイヤー。RESEND_API_KEY未設定時はコンソール出力のみの
// モック実装で動作する(src/lib/ai/index.ts と同じ考え方)。
// 呼び出し側はこのモジュールの sendEmail のみを利用し、特定のメール送信サービスに
// 直接依存しないこと(将来サービスを乗り換える場合もここだけ直せばよいようにする)。

const isMockMode = () => !process.env.RESEND_API_KEY;

export async function sendEmail(params: { to: string; subject: string; text: string }): Promise<void> {
  if (isMockMode()) {
    // 開発中・APIキー未設定時は実際には送信せず、ログに出すだけにする。
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
    // メール送信失敗はログに残すが、呼び出し元の処理(会社登録等)自体は止めない
    // (再送・手動確認で回復できるようにするため)。
    console.error(`[email:error] status=${response.status} to=${params.to}`);
  }
}
