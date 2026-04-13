import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://ligacup.se";

export const metadata: Metadata = {
  title: "Ligacup.se — Tipslag för VM 2026",
  description:
    "Skapa ett privat tipslag, förutsäg matchresultat och tävla om äran med dina vänner. Gratis att använda.",
  metadataBase: new URL(APP_URL),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Ligacup.se — Tipslag för VM 2026",
    description:
      "Skapa ett privat tipslag, förutsäg matchresultat och tävla om äran med dina vänner. Gratis att använda.",
    siteName: "Ligacup.se",
    locale: "sv_SE",
    type: "website",
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Ligacup.se — Tipslag för VM 2026",
    description:
      "Skapa ett privat tipslag, förutsäg matchresultat och tävla om äran med dina vänner. Gratis att använda.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="sv" className={`${plusJakartaSans.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
