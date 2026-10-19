import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { requireOwnerPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-7 sm:px-6 sm:pt-9">{children}</main>
      <Footer />
    </div>
  );
}
