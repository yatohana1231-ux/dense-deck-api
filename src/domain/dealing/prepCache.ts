import type { CardType } from "../cards/types.js";
import { generateDeck } from "../cards/deck.js";
import { getHandClass } from "../cards/handClass.js";
import type { Mode } from "./types.js";
import { getWeight } from "./weights.js";

export type Combo = [CardType, CardType];

export type ComboPrep = {
  combosByClass: Map<string, Combo[]>;
  weightedKeys: { key: string; effectiveWeight: number }[];
  totalWeight: number;
};

const cache = new Map<Mode, ComboPrep>();

export function getPrep(mode: Mode): ComboPrep {
  const cached = cache.get(mode);
  if (cached) return cached;

  const deck = generateDeck();
  const combosByClass = new Map<string, Combo[]>();

  // 1326コンボ列挙
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      const c1 = deck[i];
      const c2 = deck[j];
      const classKey = getHandClass(c1, c2);

      const arr = combosByClass.get(classKey);
      if (arr) arr.push([c1, c2]);
      else combosByClass.set(classKey, [[c1, c2]]);
    }
  }

  // classWeight × combos数 = effectiveWeight
  const weightedKeys: { key: string; effectiveWeight: number }[] = [];
  let totalWeight = 0;

  for (const [key, combos] of combosByClass.entries()) {
    const w = getWeight(key, mode);
    if (w <= 0) continue;
    const eff = w * combos.length;
    if (eff <= 0) continue;
    weightedKeys.push({ key, effectiveWeight: eff });
    totalWeight += eff;
  }

  if (weightedKeys.length === 0 || totalWeight <= 0) {
    throw new Error(`No weighted classes available for mode=${mode}`);
  }

  const prep: ComboPrep = { combosByClass, weightedKeys, totalWeight };
  cache.set(mode, prep);
  return prep;
}

