import "server-only";
import { randomInt } from "node:crypto";
export interface Pair {
  giver_id: string;
  receiver_id: string;
}
export function assertDistribution(
  ids: readonly string[],
  pairs: readonly Pair[],
): void {
  const members = new Set(ids);
  if (
    ids.length < 2 ||
    members.size !== ids.length ||
    pairs.length !== ids.length ||
    new Set(pairs.map((p) => p.giver_id)).size !== ids.length ||
    new Set(pairs.map((p) => p.receiver_id)).size !== ids.length ||
    pairs.some(
      (p) =>
        p.giver_id === p.receiver_id ||
        !members.has(p.giver_id) ||
        !members.has(p.receiver_id),
    )
  )
    throw new Error("INVALID_DRAW");
}
/** Fisher–Yates uniforme + rejeição: todas as permutações sem pontos fixos têm a mesma probabilidade. */
export function generateDerangement(ids: readonly string[]): Pair[] {
  if (ids.length < 2 || ids.length > 1000 || new Set(ids).size !== ids.length)
    throw new Error("INVALID_DRAW");
  for (let attempt = 0; attempt < 1000; attempt++) {
    const recipients = [...ids];
    for (let i = recipients.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [recipients[i], recipients[j]] = [recipients[j], recipients[i]];
    }
    if (recipients.some((id, i) => id === ids[i])) continue;
    const pairs = ids.map((id, i) => ({
      giver_id: id,
      receiver_id: recipients[i],
    }));
    assertDistribution(ids, pairs);
    return pairs;
  }
  // Probabilidade de esgotar 1000 tentativas é desprezível; falha fechada sem enviesar o sorteio.
  throw new Error("INVALID_DRAW");
}
