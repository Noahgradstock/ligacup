/**
 * Upsert the current Clerk user into the users table.
 * Called on dashboard load so the app works even if the webhook hasn't fired.
 */
import { currentUser } from "@clerk/nextjs/server";
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
        // displayName is intentionally excluded — it is set on first insert
        // from Clerk and thereafter only changed via /api/profile.
        // Including it here would overwrite the user's custom name on every page load.
        username: clerkUser.username ?? null,
        avatarUrl: clerkUser.imageUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}
