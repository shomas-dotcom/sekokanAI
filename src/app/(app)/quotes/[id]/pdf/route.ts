import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { renderPrintPageToPdf } from "@/lib/pdf/renderPdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const quote = await prisma.quote.findFirst({ where: { id, companyId: user.companyId }, select: { id: true, title: true } });
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

  const filename = `見積書_${quote.title}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
