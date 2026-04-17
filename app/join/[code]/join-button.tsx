"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function JoinButton({ code, leagueId }: { code: string; leagueId: string }) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function join() {
    if (!isSignedIn) {
      router.push(`/sign-in?redirect_url=/join/${code}`);
      return;
    }

    setStatus("joining");
    const res = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (res.ok) {
      router.push(`/league/${leagueId}`);
    } else {
      setErrorMsg(await res.text());
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 items-center">
      <Button size="lg" onClick={join} disabled={!isLoaded || status === "joining"} className="w-full">
        {status === "joining"
          ? "Går med..."
          : !isLoaded
          ? "Laddar..."
          : !isSignedIn
          ? "Logga in för att gå med"
          : "Gå med i laget"}
      </Button>
      {status === "error" && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}
