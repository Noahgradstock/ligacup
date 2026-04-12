import Link from "next/link";
import { LogoWordmark } from "@/components/logo-wordmark";

export const metadata = {
  title: "Integritetspolicy — Ligacup.se",
};

export default function PolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="text-xl">
          <LogoWordmark />
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Integritetspolicy</h1>
        <p className="text-muted-foreground text-sm mb-10">Senast uppdaterad: april 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-6">
          <p>
            Innehåll kommer snart. Vi jobbar på att fylla den här sidan med information om hur
            Ligacup.se hanterar dina uppgifter.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">
          ← Tillbaka till startsidan
        </Link>
      </footer>
    </div>
  );
}
