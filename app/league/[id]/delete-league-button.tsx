"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteLeagueButton({ leagueId, leagueName }: { leagueId: string; leagueName: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const router = useRouter();

  const confirmed = input.trim() === leagueName.trim();

  async function handleDelete() {
    if (!confirmed) return;
    setStatus("deleting");
    const res = await fetch(`/api/leagues/${leagueId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
    } else {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-destructive/70 hover:text-destructive transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        Radera tipslag
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-background rounded-xl border border-border w-full max-w-md flex flex-col gap-5 p-6 shadow-xl">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-destructive">Ta bort tipslag</h2>
              <p className="text-sm text-muted-foreground">
                Detta går inte att ångra. Alla medlemmar, poäng och chattar raderas permanent.
              </p>
            </div>

            <div className="rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              Du håller på att ta bort <strong>{leagueName}</strong>.
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Skriv <span className="font-mono font-bold">{leagueName}</span> för att bekräfta
              </label>
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setStatus("idle"); }}
                placeholder={leagueName}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
                autoFocus
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-destructive">Något gick fel, försök igen.</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setOpen(false); setInput(""); setStatus("idle"); }}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || status === "deleting"}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-white text-sm font-medium disabled:opacity-40 hover:bg-destructive/90 transition-colors"
              >
                {status === "deleting" ? "Tar bort..." : "Ta bort permanent"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
