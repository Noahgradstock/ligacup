"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSSE } from "@/hooks/use-sse";
import type { ChatMessage } from "@/app/api/leagues/[id]/messages/route";
import { Button } from "@/components/ui/button";

type Props = {
  leagueId: string;
  currentUserId: string;
  initial: ChatMessage[];
};

export function ChatRoom({ leagueId, currentUserId, initial }: Props) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // Append incoming SSE messages without re-fetching
  useSSE({
    url: `/api/events?leagueId=${leagueId}`,
    onMessage: (event, data) => {
      if (event === "new_message") {
        const payload = data as { message: ChatMessage };
        setMsgs((prev) => {
          // Deduplicate by id in case the sender already optimistically added it
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
      }
    },
  });

  const send = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText("");

    const res = await fetch(`/api/leagues/${leagueId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    if (res.ok) {
      const msg: ChatMessage = await res.json();
      // Optimistically add own message (SSE will deduplicate)
      setMsgs((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    }
    setSending(false);
    inputRef.current?.focus();
  }, [text, sending, leagueId]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Group consecutive messages from same user
  const grouped = msgs.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || msgs[i - 1].userId !== msg.userId,
    isMe: msg.userId === currentUserId,
  }));

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {msgs.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-10">
            Inga meddelanden ännu. Säg hej!
          </p>
        )}
        {grouped.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"} ${
              msg.isFirst ? "mt-3" : "mt-0.5"
            }`}
          >
            {msg.isFirst && (
              <span className="text-xs text-muted-foreground mb-1 px-1">
                {msg.isMe ? "Du" : msg.displayName}
              </span>
            )}
            <div className="flex items-end gap-1.5">
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.isMe
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-foreground rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {formatTime(msg.createdAt)}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 flex gap-2 items-end bg-background">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Skriv ett meddelande..."
          rows={1}
          maxLength={500}
          className="flex-1 resize-none rounded-xl border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          style={{ maxHeight: "120px" }}
        />
        <Button
          size="sm"
          onClick={send}
          disabled={sending || !text.trim()}
          className="rounded-xl shrink-0"
        >
          Skicka
        </Button>
      </div>
    </div>
  );
}
