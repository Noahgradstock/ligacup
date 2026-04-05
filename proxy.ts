import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/league(.*)",
  "/predictions(.*)",
  "/profile(.*)",
  "/notifications(.*)",
  "/admin(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Skip proxying the Clerk proxy route itself
  if (req.nextUrl.pathname.startsWith("/__clerk")) return;
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  // Redirect signed-in users away from auth pages
  if (isAuthRoute(req)) {
    const { userId } = await auth();
    if (userId) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
