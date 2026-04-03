"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);

  async function handleClick() {
    if (count > 0) {
      await fetch("/api/notifications/read", { method: "POST" });
      setCount(0);
    }
    router.push("/notifications");
  }

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-secondary transition-colors"
      aria-label="Notifikationer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-foreground"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
