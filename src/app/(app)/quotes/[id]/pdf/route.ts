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

  const quote = await prisma.quote.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, title: true, createdAt: true, project: { select: { name: true, customer: { select: { name: true } } } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "見積が見つかりません。" }, { status: 404 });
  }

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "ログインし直してください。" }, { status: 401 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderPrintPageToPdf(`/quotes/${quote.id}/print`, token);
  } catch (error) {
    console.error("見積PDFの生成に失敗しました", error);
    return NextResponse.json(
      { error: "PDFの生成に失敗しました。お手数ですが「印刷 / PDF保存」からブラウザの印刷機能でお試しください。" },
      { status: 500 }
    );
  }

  // 日付・顧客名・工事名がわかるファイル名にする(依頼: 「日付と工事名顧客名を記載したファイル名」)。
  const dateText = quote.createdAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const customerName = sanitizeFilenameComponent(quote.project.customer.name);
  const projectName = sanitizeFilenameComponent(quote.project.name);
  const filename = `見積書_${dateText}_${customerName}_${projectName}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(filename),
    },
  });
}
