import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id, photoId } = await params;
  const user = await requireUser();

  const photo = await prisma.dailyReportPhoto.findFirst({
    where: { id: photoId, dailyReportId: id, companyId: user.companyId },
  });
  if (!photo) {
    return NextResponse.json({ error: "写真が見つかりません。" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
