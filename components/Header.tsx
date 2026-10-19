import { LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Logo />
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NavLinks />
          <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" aria-hidden="true" />
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex size-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-sunken hover:text-ink"
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
