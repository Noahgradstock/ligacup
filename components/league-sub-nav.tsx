"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";

function getBaseTabs(locale: ReturnType<typeof useLocale>) {
  return [
    { id: "tabell", label: t("navStandings", locale), href: (id: string) => `/league/${id}` },
    { id: "tippa", label: t("navGroupPicks", locale), href: (id: string) => `/league/${id}/predictions`, requiresMatchScores: true },
    { id: "slutspel", label: t("navKnockout", locale), href: (id: string) => `/league/${id}/bracket`, requiresMatchScores: true },
    { id: "bonustips", label: t("navBonusPicks", locale), href: (id: string) => `/league/${id}/bonus`, requiresBonusFeature: true },
    { id: "jamfor", label: t("navCompare", locale), href: (id: string) => `/league/${id}/compare` },
    { id: "chatt", label: t("navChat", locale), href: (id: string) => `/league/${id}/chat` },
  ];
}

const BONUS_FEATURES = ["top_scorer", "most_yellow_cards"];

export function LeagueSubNav({ leagueId, features = [] }: { leagueId: string; features?: string[] }) {
  const pathname = usePathname();
  const locale = useLocale();
  const BASE_TABS = getBaseTabs(locale);
  const hasMatchScores = features.includes("match_scores");
  const hasBonusFeature = features.some((f) => BONUS_FEATURES.includes(f));

  function activeTab() {
    if (pathname.endsWith("/bracket")) return "slutspel";
    if (pathname.endsWith("/predictions")) return "tippa";
    if (pathname.endsWith("/chat")) return "chatt";
    if (pathname.endsWith("/bonus")) return "bonustips";
    if (pathname.endsWith("/compare")) return "jamfor";
    return "tabell";
  }

  const current = activeTab();
  const tabs = BASE_TABS.filter((tab) => {
    if (tab.requiresMatchScores && !hasMatchScores) return false;
    if (tab.requiresBonusFeature && !hasBonusFeature) return false;
    return true;
  });

  return (
    <div className="border-b border-border relative">
      {/* Fade-out gradient on the right to signal scrollability on mobile */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 sm:hidden"
        style={{ background: "linear-gradient(to right, transparent, var(--background))" }}
        aria-hidden
      />
      {/* Outer centering wrapper */}
      <div className="max-w-2xl mx-auto w-full">
        <div
          className="flex gap-0 overflow-x-auto overflow-y-hidden scrollbar-none px-2"
          style={{ touchAction: "pan-x" }}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href(leagueId)}
              className={`shrink-0 px-4 py-3.5 text-sm font-semibold border-b-[3px] -mb-px transition-colors ${
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
    </div>
  );
}
