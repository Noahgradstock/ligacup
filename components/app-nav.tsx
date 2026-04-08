import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, notifications } from "@/lib/db/schema";
import { NotificationBell } from "./notification-bell";
import { LogoWordmark } from "./logo-wordmark";

type Props = {
  /** Show a back link instead of the logo link going to dashboard */
  backHref?: string;
  backLabel?: string;
  /** Centered bold title */
  centerTitle?: string;
  /** Right-side content override */
  rightSlot?: React.ReactNode;
};

export async function AppNav({ backHref, backLabel, centerTitle, rightSlot }: Props = {}) {
  const { userId: clerkId } = await auth();

  let unreadCount = 0;
  if (clerkId) {
    // Look up by clerkId — don't upsert here (AppNav renders on every page)
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (user) {
      const [{ value }] = await db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));
      unreadCount = value;
    }
  }

  return (
    <nav className="relative flex items-center justify-between px-6 py-4 border-b border-border">
      <Link
        href={backHref ?? "/dashboard"}
        className="font-bold text-xl tracking-tight shrink-0"
      >
        {backLabel ? (
          <span className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors">
            ← {backLabel}
          </span>
        ) : (
          <LogoWordmark showDotSe={false} />
        )}
      </Link>

      {centerTitle && (
        <span className="absolute left-1/2 -translate-x-1/2 text-base font-bold truncate max-w-[40%] text-center pointer-events-none">
          {centerTitle}
        </span>
      )}

      <div className="flex items-center gap-2 shrink-0">
        {rightSlot}
        {clerkId && <NotificationBell initialCount={unreadCount} />}
      </div>
    </nav>
  );
}
