"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewLeaguePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const res = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/league/${data.id}`);
    } else {
      setErrorMsg(await res.text());
      setStatus("error");
    }
  }

  return (
    <main className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/dashboard" className="font-bold text-xl tracking-tight">
          Ligacup<span className="text-primary">.se</span>
        </Link>
      </nav>

      <div className="max-w-md mx-auto w-full px-6 py-16 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Skapa tipslag</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ge laget ett namn. Du får en inbjudningslänk att dela med vänner.
          </p>
        </div>

        <form onSubmit={create} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Lagets namn
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Kansliet VM-tips"
              minLength={2}
              maxLength={50}
              required
              className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}

          <Button type="submit" disabled={status === "saving" || name.trim().length < 2}>
            {status === "saving" ? "Skapar..." : "Skapa tipslag"}
          </Button>
        </form>
      </div>
    </main>
  );
}
