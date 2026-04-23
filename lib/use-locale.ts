"use client";

import type { Locale } from "./i18n";

export function useLocale(): Locale {
  if (typeof document === "undefined") return "sv";
  return (document.cookie.match(/ligacup_locale=([^;]+)/)?.[1] ?? "sv") as Locale;
}
