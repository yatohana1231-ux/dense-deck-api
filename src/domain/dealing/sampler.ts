export function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function drawWeightedKey(
  weightedKeys: { key: string; effectiveWeight: number }[],
  totalWeight: number
): string {
  let r = Math.random() * totalWeight;
  for (const { key, effectiveWeight } of weightedKeys) {
    if (r < effectiveWeight) return key;
    r -= effectiveWeight;
  }
  return weightedKeys[weightedKeys.length - 1].key;
}

