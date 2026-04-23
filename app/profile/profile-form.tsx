"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/use-locale";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function ProfileForm({
  initialName,
  initialLocale,
}: {
  initialName: string;
  initialLocale: Locale;
}) {
  const cookieLocale = useLocale();
  // Use cookie if available (post-save), otherwise fall back to DB value
  const [locale, setLocale] = useState<Locale>(cookieLocale !== "sv" ? cookieLocale : initialLocale);
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "ratelimit">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });

    if (res.ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else if (res.status === 429) {
      setErrorMsg(await res.text());
      setStatus("ratelimit");
    } else {
      setStatus("error");
    }
  }

  async function changeLocale(newLocale: Locale) {
    setLocale(newLocale);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: newLocale }),
    });
    // Reload so all server components re-render with the new locale
    window.location.reload();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {status === "ratelimit" && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          {errorMsg}
        </div>
      )}

      {/* Language selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">
          {t("languageLabel", locale)}
        </label>
        <div className="flex gap-2">
          {(["sv", "en"] as Locale[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => changeLocale(l)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                locale === l
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary/50"
              }`}
            >
              {l === "sv" ? "🇸🇪 Svenska" : "🇬🇧 English"}
            </button>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm text-muted-foreground">
          {t("displayNameLabel", locale)}
        </label>
        <input
          id="displayName"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setStatus("idle"); }}
          maxLength={40}
          placeholder={t("yourNamePlaceholder", locale)}
          className="rounded border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <Button
        type="submit"
        disabled={status === "saving" || name.trim().length === 0}
        variant={status === "saved" ? "outline" : "default"}
      >
        {status === "saving"
          ? t("saving", locale)
          : status === "saved"
          ? t("saved", locale)
          : status === "error"
          ? t("saveError", locale)
          : status === "ratelimit"
          ? t("tryAgainLater", locale)
          : t("save", locale)}
      </Button>
    </form>
  );
}
