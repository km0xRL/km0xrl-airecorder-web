"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/", label: "Записи" },
  { href: "/settings", label: "Настройки" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1" aria-label="Разделы">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/recordings") : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-3 py-2 text-[12.5px] font-medium transition-colors sm:px-3.5 sm:text-[13px]",
              active ? "bg-ink text-white" : "text-ink-500 hover:bg-sunken hover:text-ink",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
