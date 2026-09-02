"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/ai-tools", label: "AIツール" },
  { href: "/customers", label: "顧客" },
  { href: "/employees", label: "従業員" },
  { href: "/projects", label: "案件" },
  { href: "/quotes", label: "見積" },
  { href: "/rate-master", label: "単価マスタ" },
  { href: "/contracts", label: "契約" },
  { href: "/invoices", label: "請求" },
  { href: "/daily-reports", label: "日報" },
  { href: "/ky", label: "KY" },
  { href: "/work-items", label: "作業内容マスタ" },
  { href: "/construction-plans", label: "施工計画書" },
  { href: "/account", label: "アカウント" },
  { href: "/billing", label: "ご契約" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin ? [...NAV, { href: "/settings", label: "会社設定" }] : NAV;

  return (
    <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 pb-2 text-sm">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "shrink-0 rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800"
                : "shrink-0 rounded-full px-3 py-1.5 font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            }
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/premium"
        className={
          pathname.startsWith("/premium")
            ? "ml-1 shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 font-medium text-white"
            : "ml-1 shrink-0 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-3 py-1.5 font-medium text-white transition hover:from-indigo-500 hover:to-violet-500"
        }
      >
        ✨ AIプレミアム
      </Link>
    </nav>
  );
}
