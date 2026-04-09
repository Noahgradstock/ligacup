"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_TABS = [
  { id: "tabell", label: "Tabell", href: (id: string) => `/league/${id}` },
  { id: "tippa", label: "Grupptips", href: (id: string) => `/league/${id}/predictions` },
  { id: "slutspel", label: "Slutspel", href: (id: string) => `/league/${id}/bracket` },
  { id: "bonustips", label: "Bonustips", href: (id: string) => `/league/${id}/bonus`, requiresFeature: true },
  { id: "chatt", label: "Chatt", href: (id: string) => `/league/${id}/chat` },
];

const BONUS_FEATURES = ["top_scorer", "most_yellow_cards"];

export function LeagueSubNav({ leagueId, features = [] }: { leagueId: string; features?: string[] }) {
  const pathname = usePathname();
  const hasBonusFeature = features.some((f) => BONUS_FEATURES.includes(f));

  function activeTab() {
    if (pathname.endsWith("/bracket")) return "slutspel";
    if (pathname.endsWith("/predictions")) return "tippa";
    if (pathname.endsWith("/chat")) return "chatt";
    if (pathname.endsWith("/bonus")) return "bonustips";
    return "tabell";
  }

  const current = activeTab();
  const tabs = BASE_TABS.filter((tab) => !tab.requiresFeature || hasBonusFeature);

  return (
    <div className="border-b border-border px-4 flex flex-col">
      <div className="flex gap-0 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href(leagueId)}
            className={`shrink-0 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
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
