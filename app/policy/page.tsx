import Link from "next/link";
import { LogoWordmark } from "@/components/logo-wordmark";

export const metadata = {
  title: "Integritetspolicy — Ligacup.se",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="text-xl">
          <LogoWordmark />
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Integritetspolicy</h1>
        <p className="text-muted-foreground text-sm mb-10">Senast uppdaterad: april 2026</p>

        <div className="flex flex-col gap-10">

          <Section title="1. Om Ligacup.se">
            <p>
              Ligacup.se är ett gratis tipsspel för VM 2026 där du kan skapa privata tipslag och
              tävla med vänner om matchresultat. Inga pengar eller insatser hanteras på plattformen.
            </p>
            <p>
              Tjänsten drivs som ett hobby-/sidoprojekt och riktar sig till privatpersoner i Sverige
              och Norden.
            </p>
          </Section>

          <Section title="2. Vilken data vi samlar in">
            <p>När du skapar ett konto samlas följande in:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>E-postadress</li>
              <li>Namn eller visningsnamn (valfritt)</li>
              <li>Profilbild (om du loggar in via Google eller liknande)</li>
            </ul>
            <p>När du använder tjänsten lagras även:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Dina matchresultattips och VM-förutsägelser</li>
              <li>Vilket/vilka tipslag du tillhör</li>
              <li>Chattmeddelanden inom tipslag</li>
              <li>Notifikationer kopplade till ditt konto</li>
            </ul>
          </Section>

          <Section title="3. Hur vi använder din data">
            <p>Din data används uteslutande för att:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Driva och förbättra tjänsten</li>
              <li>Visa dina tips och resultat inom ditt tipslag</li>
              <li>Skicka notifikationer relaterade till tipslaget</li>
            </ul>
            <p>
              Vi säljer inte din data, delar den inte med tredje part i marknadsföringssyfte och
              använder den inte för profilering eller reklam.
            </p>
          </Section>

          <Section title="4. Tredjepartstjänster">
            <p>Vi använder följande externa tjänster för att driva Ligacup.se:</p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                <span className="font-medium text-foreground">Clerk</span> — hanterar inloggning
                och kontouppgifter. Din e-post och autentiseringsdata lagras hos Clerk.
                Se deras policy på{" "}
                <a
                  href="https://clerk.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground transition-colors"
                >
                  clerk.com/privacy
                </a>
                .
              </li>
              <li>
                <span className="font-medium text-foreground">Vercel</span> — hosting och
                serverinfrastruktur. Data behandlas inom EU/EES.
              </li>
              <li>
                <span className="font-medium text-foreground">Neon / Supabase</span> — databas där
                tips, lag och medlemsdata lagras.
              </li>
            </ul>
          </Section>

          <Section title="5. Cookies och lokal lagring">
            <p>
              Ligacup.se använder inga spårningscookies eller annonskookies. Vi använder:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>
                <span className="font-medium text-foreground">Sessions-cookies</span> — sätts av
                Clerk för att hålla dig inloggad.
              </li>
              <li>
                <span className="font-medium text-foreground">localStorage</span> — sparar
                lokalt dina filterval i appen (t.ex. vald grupp i jämförelsevy). Ingen
                personlig data skickas.
              </li>
            </ul>
          </Section>

          <Section title="6. Dina rättigheter (GDPR)">
            <p>
              Som användare har du rätt att när som helst:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Begära ut den data vi har om dig</li>
              <li>Begära rättelse av felaktiga uppgifter</li>
              <li>Begära radering av ditt konto och tillhörande data</li>
            </ul>
            <p>
              Kontakta oss på e-postadressen nedan för att utöva dina rättigheter. Vi svarar inom
              30 dagar.
            </p>
          </Section>

          <Section title="7. Datalagringstid">
            <p>
              Vi lagrar dina uppgifter så länge ditt konto är aktivt. Om du begär radering tar vi
              bort ditt konto och all kopplad data, med undantag för anonymiserad statistik som
              inte kan kopplas till dig.
            </p>
          </Section>

          <Section title="8. Kontakt">
            <p>
              Har du frågor om hur vi hanterar din data, kontakta oss på:{" "}
              <a
                href="mailto:hej@ligacup.se"
                className="underline hover:text-foreground transition-colors"
              >
                hej@ligacup.se
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground mt-8">
        <Link href="/" className="hover:text-foreground transition-colors">
          ← Tillbaka till startsidan
        </Link>
      </footer>
    </div>
  );
}
