import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, leagues, leagueMembers, tournaments } from "@/lib/db/schema";

function randomInviteCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: {
    name: string;
    isPublic?: boolean;
    maxMembers?: number;
    features?: string[];
    scoring?: { exactScore: number; correctWinner: number; correctDraw: number };
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length < 2 || name.length > 50) {
    return new Response("Name must be 2–50 characters", { status: 400 });
  }

  const maxMembers = Math.min(200, Math.max(2, body.maxMembers ?? 20));
  const isPublic = body.isPublic ?? false;
  const validFeatureKeys = ["match_scores", "tournament_winner", "top_scorer", "group_winners", "finalist", "most_red_cards"];
  const features = ["match_scores", ...((body.features ?? []).filter((f) => validFeatureKeys.includes(f) && f !== "match_scores"))];
  const scoring = {
    exactScore: Math.min(10, Math.max(0, body.scoring?.exactScore ?? 3)),
    correctWinner: Math.min(10, Math.max(0, body.scoring?.correctWinner ?? 1)),
    correctDraw: Math.min(10, Math.max(0, body.scoring?.correctDraw ?? 1)),
  };

  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return new Response("User not found — webhook not yet processed", { status: 404 });

  // Always link to vm-2026
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, "vm-2026"))
    .limit(1);
  if (!tournament) return new Response("Tournament not seeded", { status: 500 });

  // Generate unique invite code (retry on collision)
  let inviteCode = randomInviteCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.inviteCode, inviteCode))
      .limit(1);
    if (existing.length === 0) break;
    inviteCode = randomInviteCode();
  }

  // Unique slug
  const baseSlug = slugify(name) || "lag";
  let slug = baseSlug;
  for (let i = 2; ; i++) {
    const existing = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.slug, slug))
      .limit(1);
    if (existing.length === 0) break;
    slug = `${baseSlug}-${i}`;
  }

  const [league] = await db
    .insert(leagues)
    .values({
      tournamentId: tournament.id,
      ownerId: user.id,
      name,
      slug,
      inviteCode,
      maxMembers,
      isPublic,
      configJson: { features, scoring },
    })
    .returning();

  // Owner auto-joins
  await db.insert(leagueMembers).values({
    leagueId: league.id,
    userId: user.id,
  });

  return Response.json({ id: league.id, inviteCode: league.inviteCode }, { status: 201 });
}
