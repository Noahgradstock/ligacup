"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      className="px-3 py-1.5 rounded border border-border bg-background text-sm hover:bg-secondary transition-colors shrink-0"
    >
      {copied ? "Kopierat!" : "Kopiera"}
    </button>
  );
}
