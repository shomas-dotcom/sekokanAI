import { redirect } from "next/navigation";
import { getSessionPlatformAdmin } from "@/lib/platformAdminSession";

export async function requirePlatformAdmin() {
  const admin = await getSessionPlatformAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
