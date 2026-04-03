import { cookies } from "next/headers";

export async function POST(request: Request) {
  let body: { password: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (body.password !== process.env.ADMIN_SECRET) {
    return new Response("Wrong password", { status: 401 });
  }

  const jar = await cookies();
  jar.set("admin_session", process.env.ADMIN_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  return Response.json({ ok: true });
}
