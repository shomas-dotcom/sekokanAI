import puppeteer, { type LaunchOptions } from "puppeteer-core";
import { SESSION_COOKIE_NAME } from "@/lib/session";

/**
 * 実際にアプリの印刷用画面(/xxx/print)をヘッドレスブラウザで開き、本物のPDFファイルの
 * バイト列を作る。印刷用画面と全く同じHTML/CSSを使うため、画面で見える内容とPDFの
 * 内容は必ず一致する(別に作り直したものではない)。
 *
 * 会社の外へは出さず、このアプリ自身(127.0.0.1)にしかアクセスしない。認証は呼び出し元が
 * 発行済みのセッションCookieをそのまま使うため、印刷用画面自体が行っている
 * 「本人か・同じ会社のデータか」の確認をそのまま通る(PDF化のために権限確認を別途作らない)。
 *
 * Chromeの起動方法は環境によって分ける(2026-09調査: Render本番でPDF生成がエラーに
 * なる不具合があり、原因は「puppeteer」パッケージが同梱する通常版Chromeが、Renderの
 * ような最小構成のLinuxコンテナでは必要な共有ライブラリが足りず起動できないことだった)。
 * - 本番(Linuxコンテナ): @sparticuz/chromium(コンテナ向けに作られた軽量版Chrome)を使う
 * - ローカル開発(Windows等): 通常のpuppeteerパッケージが同梱するChromeをそのまま使う
 *   (@sparticuz/chromiumの実行ファイルはLinux専用でWindowsでは動かないため)
 */
async function resolveLaunchOptions(): Promise<LaunchOptions> {
  if (process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      args: await puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    };
  }
  const fullPuppeteer = (await import("puppeteer")).default;
  return {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: await fullPuppeteer.executablePath(),
    headless: true,
  };
}

export async function renderPrintPageToPdf(pathAndQuery: string, sessionToken: string): Promise<Buffer> {
  const port = process.env.PORT || "3000";
  const url = `http://127.0.0.1:${port}${pathAndQuery}`;
  const launchOptions = await resolveLaunchOptions();

  const browser = await puppeteer.launch(launchOptions);
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
