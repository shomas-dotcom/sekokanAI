import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { renderPrintPageToPdf } from "@/lib/pdf/renderPdf";
import { buildContentDisposition, sanitizeFilenameComponent } from "@/lib/pdf/pdfFilename";
import { monthParamString, parseMonthParam, resolveSheetEmployee } from "@/lib/timesheet/monthlySheet";

/** 個人別の月間出勤簿をPDFでダウンロードする(管理者は employeeId で他の従業員も指定できる)。 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const user = await requireUser();
  const employee = await resolveSheetEmployee(user, url.searchParams.get("employeeId") ?? undefined);
  if (!employee) {
    return NextResponse.json(
      { error: "出勤簿の対象の従業員が見つかりません。ログイン利用者と従業員の関連付けを確認してください。" },
      { status: 404 }
    );
  }
  const { year, month } = parseMonthParam(url.searchParams.get("month") ?? undefined);
  const monthText = monthParamString(year, month);

  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "ログインし直してください。" }, { status: 401 });
  }

  let buffer: Buffer;
  try {
    buffer = await renderPrintPageToPdf(`/attendance/print?month=${monthText}&employeeId=${employee.id}`, token);
  } catch (error) {
    console.error("出勤簿PDFの生成に失敗しました", error);
    return NextResponse.json(
      { error: "PDFの生成に失敗しました。お手数ですが「印刷」画面からブラウザの印刷機能でお試しください。" },
      { status: 500 }
    );
  }

  const filename = `出勤簿_${monthText}_${sanitizeFilenameComponent(employee.name)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": buildContentDisposition(filename),
    },
  });
}
