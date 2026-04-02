import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </Link>
        <span className="text-sm text-muted-foreground">
          {user?.firstName ?? user?.emailAddresses[0]?.emailAddress}
        </span>
      </nav>

      {/* Quick actions */}
      <section className="border-b border-border px-6 py-4 flex gap-3">
        <Link href="/predictions">
          <Button variant="outline" size="sm">⚽ Tippa matcher</Button>
        </Link>
        <Link href="/league/new">
          <Button variant="outline" size="sm">+ Skapa tipslag</Button>
        </Link>
        <Link href="/join">
          <Button variant="outline" size="sm">Gå med via länk</Button>
        </Link>
      </section>

      {/* Empty state */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-3xl">
          ⚽
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Dina tipslag</h1>
        <p className="text-muted-foreground max-w-sm">
          Du är inte med i något tipslag ännu. Skapa ett eget eller gå med via en inbjudningslänk.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/league/new">
            <Button size="lg">Skapa tipslag</Button>
          </Link>
          <Link href="/join">
            <Button size="lg" variant="outline">Gå med via länk</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
