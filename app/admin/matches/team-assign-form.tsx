"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Team = { id: string; name: string; flag: string };

export function TeamAssignForm({
  matchId,
  homeSlot,
  awaySlot,
  teams,
}: {
  matchId: string;
  homeSlot: string;
  awaySlot: string;
  teams: Team[];
}) {
  const router = useRouter();
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return;
    setStatus("saving");

    const res = await fetch("/api/admin/assign-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, homeTeamId, awayTeamId }),
    });

    if (res.ok) {
      const data = await res.json();
      setMsg(`${data.home} vs ${data.away}`);
      setStatus("saved");
      router.refresh();
    } else {
      setMsg(await res.text());
      setStatus("error");
    }
  }

  if (status === "saved") {
    return <span className="text-sm text-green-600 font-medium">{msg} ✓</span>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          {homeSlot}
        </span>
        <select
          value={homeTeamId}
          onChange={(e) => setHomeTeamId(e.target.value)}
          required
          className="rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[130px]"
        >
          <option value="">Välj lag...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
              {t.flag} {t.name}
            </option>
          ))}
        </select>
      </div>
      <span className="text-muted-foreground font-bold mt-3">vs</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
          {awaySlot}
        </span>
        <select
          value={awayTeamId}
          onChange={(e) => setAwayTeamId(e.target.value)}
          required
          className="rounded border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-[130px]"
        >
          <option value="">Välj lag...</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
              {t.flag} {t.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={status === "saving" || !homeTeamId || !awayTeamId} className="text-xs mt-3">
        {status === "saving" ? "..." : "Tilldela"}
      </Button>
      {status === "error" && <span className="text-xs text-destructive">{msg}</span>}
    </form>
  );
}
