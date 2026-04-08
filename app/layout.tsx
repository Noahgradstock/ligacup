import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Ligacup.se — Tipslag för VM 2026",
  description:
    "Skapa ett privat tipslag, förutsäg matchresultat och tävla om äran med dina vänner. Gratis att använda.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    siteName: "Ligacup.se",
    locale: "sv_SE",
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
