import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "./logout-action";
import { Button } from "@/components/ui";
import { NavLinks } from "./NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-sm font-bold text-white shadow-sm shadow-orange-600/30">
              現
            </span>
            <span className="font-bold tracking-tight text-slate-900">現場AI</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">
              {user.company.name} / {user.name}
            </span>
            <form action={logoutAction}>
              <Button variant="secondary">ログアウト</Button>
            </form>
          </div>
        </div>
        <NavLinks />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 print:max-w-none print:p-0">
        {children}
      </main>
    </div>
  );
}
