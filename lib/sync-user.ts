/**
 * Upsert the current Clerk user into the users table.
 * Called on dashboard load so the app works even if the webhook hasn't fired.
 */
import { currentUser } from "@clerk/nextjs/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function syncCurrentUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const primaryEmail =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) return null;

  const displayName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [user] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      email: primaryEmail,
      displayName,
      username: clerkUser.username ?? null,
      avatarUrl: clerkUser.imageUrl ?? null,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: primaryEmail,
        // Keep the user's custom display name if they've set one;
        // only fall back to Clerk name when the DB value is null.
        displayName: sql`COALESCE(${users.displayName}, ${displayName})`,
        username: clerkUser.username ?? null,
        avatarUrl: clerkUser.imageUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}
