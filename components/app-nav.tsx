import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { eq, and, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, notifications } from "@/lib/db/schema";
import { NotificationBell } from "./notification-bell";
import { LogoWordmark } from "./logo-wordmark";
import { DesktopCenterNav } from "./desktop-center-nav";

type Props = {
  /** Show a back link instead of the logo link going to dashboard */
  backHref?: string;
  backLabel?: string;
  /** Centered bold title — shown on mobile only (desktop uses center nav) */
  centerTitle?: string;
  /** Right-side content override */
  rightSlot?: React.ReactNode;
  /** Hide the global icon nav (home/bell/profile) — use inside league pages */
  hideNav?: boolean;
};

export async function AppNav({ backHref, backLabel, centerTitle, rightSlot, hideNav = false }: Props = {}) {
  const { userId: clerkId } = await auth();

  let unreadCount = 0;
  if (clerkId) {
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
    <nav className="relative flex items-center justify-between px-6 h-14 border-b border-border">
      {/* Left — always logo */}
      <Link href="/dashboard" className="font-bold text-xl tracking-tight shrink-0">
        <LogoWordmark />
      </Link>

      {/* Center — desktop: icon nav | mobile: page/league title */}
      {clerkId && !hideNav && <DesktopCenterNav unreadCount={unreadCount} />}
      {centerTitle && (
        <span className="sm:hidden absolute left-1/2 -translate-x-1/2 text-base font-bold truncate max-w-[40%] text-center pointer-events-none">
          {centerTitle}
        </span>
      )}

      {/* Right — back link OR notification bell (mobile only) */}
      <div className="flex items-center gap-3 shrink-0">
        {rightSlot}
        {backHref ? (
          <Link
            href={backHref}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {backLabel ?? "Tillbaka"}
          </Link>
        ) : (
          clerkId && !hideNav && (
            <div className="sm:hidden">
              <NotificationBell initialCount={unreadCount} />
            </div>
          )
        )}
      </div>
    </nav>
  );
}
