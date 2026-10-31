/** Explicit R$ amounts only. BR thousands/dot or comma decimals; no price lookup. */
export function giftWithinLimit(text: string): boolean {
  const prices = text.matchAll(/R\$\s*([0-9]+(?:[.,][0-9]+)*)/giu);
  for (const [, raw] of prices) {
    let amount: number;
    if (/^[0-9]{1,3}(?:\.[0-9]{3})+(?:,[0-9]{1,2})?$/.test(raw))
      amount = Number(raw.replaceAll(".", "").replace(",", "."));
    else if (/^[0-9]+(?:[.,][0-9]{1,2})?$/.test(raw))
      amount = Number(raw.replace(",", "."));
    else continue; // Ambiguous/unsupported notation is not a verified price.
    if (amount > 50) return false;
  }
  return true;
}
