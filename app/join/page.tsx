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

      <section className="relative bg-[#0d1f3c] px-6 py-6 overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 w-44 h-44 rounded-full bg-[#e6a800]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="max-w-sm mx-auto relative flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Gå med i ett tipslag</h1>
          <p className="text-white/55 text-sm">Ange inbjudningskoden (8 tecken) du fått av lagledaren.</p>
        </div>
      </section>

      <div className="max-w-sm mx-auto w-full px-6 py-10 flex flex-col gap-8">

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
