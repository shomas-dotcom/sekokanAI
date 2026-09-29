import puppeteer from "puppeteer";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * 実際にアプリの印刷用画面(/xxx/print)をヘッドレスブラウザで開き、本物のPDFファイルの
 * バイト列を作る。印刷用画面と全く同じHTML/CSSを使うため、画面で見える内容とPDFの
 * 内容は必ず一致する(別に作り直したものではない)。
 *
 * 会社の外へは出さず、このアプリ自身(127.0.0.1)にしかアクセスしない。認証は呼び出し元が
 * 発行済みのセッションCookieをそのまま使うため、印刷用画面自体が行っている
 * 「本人か・同じ会社のデータか」の確認をそのまま通る(PDF化のために権限確認を別途作らない)。
 */
export async function renderPrintPageToPdf(pathAndQuery: string, sessionToken: string): Promise<Buffer> {
  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}${pathAndQuery}`;

  const browser = await puppeteer.launch({
    headless: true,
    // Renderのようなコンテナ環境ではChromeの通常のサンドボックス機能が使えないことが多いため、
    // 無効化する(自社の印刷用画面という信頼できる内部ページしか開かないため許容する)。
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setCookie({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      domain: "127.0.0.1",
      path: "/",
    });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20_000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
