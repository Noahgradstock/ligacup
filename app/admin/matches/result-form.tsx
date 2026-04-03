"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ResultForm({ matchId }: { matchId: string }) {
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return;

    setStatus("saving");
    const res = await fetch("/api/admin/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, homeScore: h, awayScore: a }),
    });

    if (res.ok) {
      const data = await res.json();
      setMsg(`${data.predictions} tips poängberäknade`);
      setStatus("saved");
    } else {
      setMsg(await res.text());
      setStatus("error");
    }
  }

  if (status === "saved") {
    return <span className="text-sm text-green-600 font-medium">{msg} ✓</span>;
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        type="number" min={0} max={99} value={home}
        onChange={(e) => setHome(e.target.value)}
        placeholder="H" required
        className="w-12 text-center rounded border border-border bg-background py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <span className="text-muted-foreground">–</span>
      <input
        type="number" min={0} max={99} value={away}
        onChange={(e) => setAway(e.target.value)}
        placeholder="B" required
        className="w-12 text-center rounded border border-border bg-background py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={status === "saving"} className="text-xs">
        {status === "saving" ? "..." : "Bekräfta"}
      </Button>
      {status === "error" && <span className="text-xs text-destructive">{msg}</span>}
    </form>
  );
}
