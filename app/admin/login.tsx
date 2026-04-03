"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/matches");
    } else {
      setError("Fel lösenord");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Lösenord"
        required
        className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "..." : "Logga in"}
      </Button>
    </form>
  );
}
