import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { renderPrintPageToPdf } from "@/lib/pdf/renderPdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, reportDate: true, project: { select: { name: true, customer: { select: { name: true } } } } },
  });
  if (!report) {
    return NextResponse.json({ error: "日報が見つかりません。" }, { status: 404 });
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "ログインし直してください。" }, { status: 401 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderPrintPageToPdf(`/daily-reports/${report.id}/print`, token);
  } catch (error) {
    console.error("日報PDFの生成に失敗しました", error);
    return NextResponse.json(
      { error: "PDFの生成に失敗しました。お手数ですが「印刷 / PDF」からブラウザの印刷機能でお試しください。" },
      { status: 500 }
    );
  }

  // 日付・顧客名・工事名がわかるファイル名にする(依頼: 「日付と工事名顧客名を記載したファイル名」)。
  const dateText = report.reportDate
    .toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" })
    .replaceAll("/", "");
  const filename = `日報_${dateText}_${report.project.customer.name}_${report.project.name}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
