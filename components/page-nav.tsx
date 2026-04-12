"use client";

import Link from "next/link";
import { LogoWordmark } from "./logo-wordmark";

type Props = {
  backHref?: string;
  backLabel?: string;
};

export function PageNav({ backHref, backLabel }: Props = {}) {
  return (
    <nav className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
      <Link href="/dashboard" className="font-bold text-xl tracking-tight shrink-0">
        <LogoWordmark />
      </Link>
      {backHref && (
        <Link
          href={backHref}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {backLabel ?? "Tillbaka"}
        </Link>
      )}
    </nav>
  );
}
