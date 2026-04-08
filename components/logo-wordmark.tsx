/**
 * Ligacup wordmark — "Liga" medium + "cup" bold gold + ".se" muted.
 * Drop showDotSe to hide the suffix (e.g. in-app headers).
 */
export function LogoWordmark({ showDotSe = true }: { showDotSe?: boolean }) {
  return (
    <span className="tracking-tight">
      <span className="font-medium">Liga</span>
      <span className="font-extrabold text-accent">cup</span>
      {showDotSe && <span className="font-bold text-primary">.se</span>}
    </span>
  );
}
