import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/platformAdminAuth";
import { adminLogoutAction } from "../logout-action";
import { Button } from "@/components/ui";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-bold text-white">現場AI 運営管理</span>
            <nav className="flex gap-3 text-sm text-slate-300">
              <Link href="/admin/dashboard" className="hover:text-white">
                概況
              </Link>
              <Link href="/admin/companies" className="hover:text-white">
                会社一覧
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span>{admin.name}</span>
            <form action={adminLogoutAction}>
              <Button variant="secondary">ログアウト</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
