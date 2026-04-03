/**
 * Pure point calculation engine.
 * No framework dependencies — safe to use on server and client.
 */

export type PredictionRules = {
  pointsExactScore: number;
  pointsCorrectWinner: number;
  pointsCorrectDraw: number;
};

export function calcPoints(
  pred: { home: number; away: number },
  result: { home: number; away: number },
  rules: PredictionRules
): number {
  if (pred.home === result.home && pred.away === result.away) {
    return rules.pointsExactScore;
  }
  const predOutcome = Math.sign(pred.home - pred.away);
  const realOutcome = Math.sign(result.home - result.away);
  if (predOutcome === realOutcome) {
    return realOutcome === 0 ? rules.pointsCorrectDraw : rules.pointsCorrectWinner;
  }
  return 0;
}
