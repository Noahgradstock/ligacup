import type { NextRequest } from "next/server";
import { createSubscriber, keys } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("leagueId");
  if (!leagueId) {
    return new Response("Missing leagueId", { status: 400 });
  }

  // Single unified channel — all league events (leaderboard + chat)
  const channel = keys.eventsChannel(leagueId);
  const subscriber = createSubscriber();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      send("connected", JSON.stringify({ leagueId }));

      subscriber.subscribe(channel, (err) => {
        if (err) controller.close();
      });

      subscriber.on("message", (_chan: string, raw: string) => {
        try {
          const payload = JSON.parse(raw) as { type: string };
          // Route to the correct SSE event name based on payload.type
          send(payload.type ?? "event", raw);
        } catch {
          send("event", raw);
        }
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        subscriber.unsubscribe(channel).finally(() => subscriber.quit());
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
