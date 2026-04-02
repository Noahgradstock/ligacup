import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserCreatedEvent = {
  type: "user.created" | "user.updated";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    username: string | null;
  };
};

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: ClerkUserCreatedEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserCreatedEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return new Response("Ignored", { status: 200 });
  }

  const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url, username } = event.data;
  const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id)?.email_address ?? email_addresses[0]?.email_address;

  if (!primaryEmail) {
    return new Response("No email found", { status: 400 });
  }

  const displayName = [first_name, last_name].filter(Boolean).join(" ") || null;

  await db
    .insert(users)
    .values({
      clerkId: id,
      email: primaryEmail,
      displayName,
      username: username ?? null,
      avatarUrl: image_url ?? null,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: primaryEmail,
        displayName,
        username: username ?? null,
        avatarUrl: image_url ?? null,
        updatedAt: new Date(),
      },
    });

  return new Response("OK", { status: 200 });
}
