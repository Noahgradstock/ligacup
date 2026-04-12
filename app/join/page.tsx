"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageNav } from "@/components/page-nav";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length === 8) router.push(`/join/${clean}`);
  }

  return (
    <main className="flex flex-col min-h-screen">
      <PageNav backHref="/dashboard" />

      <div className="max-w-sm mx-auto w-full px-6 py-16 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gå med i ett tipslag</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ange inbjudningskoden (8 tecken) du fått av lagledaren.
          </p>
        </div>

        <form onSubmit={go} className="flex flex-col gap-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="T.EX. AB12CD34"
            maxLength={8}
            required
            className="rounded border border-border bg-background px-3 py-2 text-sm font-mono uppercase tracking-widest text-center focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="submit" disabled={code.trim().length !== 8}>
            Sök tipslag
          </Button>
        </form>
      </div>
    </main>
  );
}
