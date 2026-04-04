import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { syncCurrentUser } from "@/lib/sync-user";

export async function POST(request: Request) {
  const dbUser = await syncCurrentUser();
  if (!dbUser) return new Response("Unauthorized", { status: 401 });

  let body: { displayName: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const displayName = body.displayName?.trim();
  if (!displayName || displayName.length < 1 || displayName.length > 40) {
    return new Response("Name must be 1–40 characters", { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, dbUser.id))
    .returning();

  return Response.json({ displayName: updated.displayName });
}
