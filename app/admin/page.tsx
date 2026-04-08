import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLogin } from "./login";
import { LogoWordmark } from "@/components/logo-wordmark";

export default async function AdminPage() {
  const jar = await cookies();
  const authed = jar.get("admin_session")?.value === process.env.ADMIN_SECRET;
  if (authed) redirect("/admin/matches");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground"><LogoWordmark /></p>
        </div>
        <AdminLogin />
      </div>
    </main>
  );
}
