import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { renderPrintPageToPdf } from "@/lib/pdf/renderPdf";
import { buildContentDisposition, sanitizeFilenameComponent } from "@/lib/pdf/pdfFilename";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const report = await prisma.dailyReport.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, reportDate: true, project: { select: { name: true } } },
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

  // 「日報_YYYY-MM-DD_現場名.pdf」形式にする。現場名が無ければ日付だけにする。
  // sv-SE(スウェーデン)ロケールはYYYY-MM-DD形式を返すため、日本時間での日付をこれで組み立てる。
  const dateText = report.reportDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const siteName = sanitizeFilenameComponent(report.project.name ?? "");
  const filename = siteName ? `日報_${dateText}_${siteName}.pdf` : `日報_${dateText}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(filename),
    },
  });
}
