import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { FileEntityType } from "@/generated/prisma/enums";

const VALID_TYPES: FileEntityType[] = ["CUSTOMER", "QUOTE", "CONTRACT", "INVOICE", "EMPLOYEE"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entityType: string; entityId: string; fileId: string }> }
) {
  const { entityType, entityId, fileId } = await params;
  const user = await requireUser();

  if (!VALID_TYPES.includes(entityType as FileEntityType)) {
    return NextResponse.json({ error: "不正な種別です。" }, { status: 400 });
  }

  const file = await prisma.entityFile.findFirst({
    where: {
      id: fileId,
      entityType: entityType as FileEntityType,
      entityId,
      companyId: user.companyId,
    },
  });
  if (!file) {
    return NextResponse.json({ error: "ファイルが見つかりません。" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
