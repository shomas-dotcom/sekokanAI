import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "./logout-action";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/customers", label: "顧客" },
  { href: "/projects", label: "案件" },
  { href: "/quotes", label: "見積" },
  { href: "/daily-reports", label: "日報" },
  { href: "/construction-plans", label: "施工計画書" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-bold text-zinc-900">
            現場AI
          </Link>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span className="hidden sm:inline">
              {user.company.name} / {user.name}
            </span>
            <form action={logoutAction}>
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-zinc-700">
                ログアウト
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
