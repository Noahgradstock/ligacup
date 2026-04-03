"use client";

import { useEffect, useRef } from "react";

type SSEOptions = {
  url: string;
  onMessage: (event: string, data: unknown) => void;
  enabled?: boolean;
};

export function useSSE({ url, onMessage, enabled = true }: SSEOptions) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(url);

      es.addEventListener("leaderboard_updated", (e) => {
        try {
          onMessageRef.current("leaderboard_updated", JSON.parse(e.data));
        } catch {
          onMessageRef.current("leaderboard_updated", e.data);
        }
      });

      es.onerror = () => {
        es.close();
        // Reconnect after 3s on error
        retryTimeout = setTimeout(connect, 3_000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      es?.close();
    };
  }, [url, enabled]);
}
