/**
 * Knockout match winner determination.
 * Handles regular time → extra time → penalties in order.
 * Safe to import on both server and client (no framework deps).
 */

export type FullPred = {
  home: number;
  away: number;
  homeET?: number | null;
  awayET?: number | null;
  homePen?: number | null;
  awayPen?: number | null;
};

/**
 * Returns true if home wins, false if away wins, null if outcome is
 * undetermined (draw in regular time with no ET/penalty result yet).
 */
export function predWinnerIsHome(pred: FullPred): boolean | null {
  if (pred.home > pred.away) return true;
  if (pred.away > pred.home) return false;
  // Regular time draw — check ET
  if (pred.homeET != null && pred.awayET != null) {
    if (pred.homeET > pred.awayET) return true;
    if (pred.awayET > pred.homeET) return false;
    // ET draw — check penalties
    if (pred.homePen != null && pred.awayPen != null) {
      if (pred.homePen > pred.awayPen) return true;
      if (pred.awayPen > pred.homePen) return false;
    }
  }
  return null;
}
