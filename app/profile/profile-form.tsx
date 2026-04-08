"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "ratelimit">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });

    if (res.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else if (res.status === 429) {
      setErrorMsg(await res.text());
      setStatus("ratelimit");
    } else {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      {status === "ratelimit" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {errorMsg}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm text-muted-foreground">
          Visningsnamn
        </label>
        <input
          id="displayName"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus("idle"); }}
          maxLength={40}
          placeholder="Ditt namn"
          className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <Button
        type="submit"
        disabled={status === "saving" || name.trim().length === 0}
        variant={status === "saved" ? "outline" : "default"}
      >
        {status === "saving" ? "Sparar..." : status === "saved" ? "Sparat ✓" : status === "error" ? "Fel – försök igen" : status === "ratelimit" ? "Försök igen senare" : "Spara"}
      </Button>
    </form>
  );
}
