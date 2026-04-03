import type { NextRequest } from "next/server";
import { createSubscriber, keys } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get("leagueId");
  if (!leagueId) {
    return new Response("Missing leagueId", { status: 400 });
  }

  const channel = keys.leaderboardChannel(leagueId);
  const subscriber = createSubscriber();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      // Send a heartbeat immediately so the browser knows the connection is live
      send("connected", JSON.stringify({ leagueId }));

      subscriber.subscribe(channel, (err) => {
        if (err) controller.close();
      });

      subscriber.on("message", (_chan: string, message: string) => {
        send("leaderboard_updated", message);
      });

      // Heartbeat every 25s to keep the connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Clean up when the client disconnects
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
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
