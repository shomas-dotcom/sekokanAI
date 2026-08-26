"use server";

import { redirect } from "next/navigation";
import { destroyPlatformAdminSession } from "@/lib/platformAdminSession";

export async function adminLogoutAction() {
  await destroyPlatformAdminSession();
  redirect("/admin/login");
}
