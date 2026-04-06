"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { id: "tabell", label: "Tabell", href: (id: string) => `/league/${id}` },
  { id: "tippa", label: "Grupptips", href: (id: string) => `/league/${id}/predictions` },
  { id: "slutspel", label: "Slutspel", href: (id: string) => `/league/${id}/bracket` },
  { id: "chatt", label: "Chatt", href: (id: string) => `/league/${id}/chat` },
];

export function LeagueSubNav({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const pathname = usePathname();

  function activeTab() {
    if (pathname.endsWith("/bracket")) return "slutspel";
    if (pathname.endsWith("/predictions")) return "tippa";
    if (pathname.endsWith("/chat")) return "chatt";
    return "tabell";
  }

  const current = activeTab();

  return (
    <div className="border-b border-border px-4 flex flex-col">
      <p className="text-sm font-semibold px-2 pt-3 pb-1">{leagueName}</p>
      <div className="flex gap-0">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href(leagueId)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              current === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
