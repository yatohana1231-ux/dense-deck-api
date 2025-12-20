import { cardId, parseCardId } from "../cards/deck.js";
import type { DealInput, DealResult } from "./types.js";
import { getPrep } from "./prepCache.js";
import { drawWeightedKey, randInt } from "./sampler.js";

const MAX_RETRY = 128;

function randomUUID(): string {
  // Node 22ならcrypto.randomUUIDがあるはず。なければfallback
  return globalThis.crypto?.randomUUID?.() ?? `H${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function dealHands(input: DealInput): DealResult {
  const { seatCount, playerOrder, boardReserved, mode } = input;
  const prep = getPrep(mode);

  // boardReserved を CardType として検証（不正ならここで例外）
  const reservedIds = new Set<string>(boardReserved.map((id) => cardId(parseCardId(id))));

  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const hands: string[][] = Array.from({ length: seatCount }, () => []);
    const used = new Set<string>(reservedIds);
    let failed = false;

    for (const seat of playerOrder) {
      const classKey = drawWeightedKey(prep.weightedKeys, prep.totalWeight);
      const combos = prep.combosByClass.get(classKey);
      if (!combos || combos.length === 0) { failed = true; break; }

      const combo = combos[randInt(combos.length)];
      const ids = combo.map(cardId);

      if (ids.some((id) => used.has(id))) { failed = true; break; }

      ids.forEach((id) => used.add(id));
      hands[seat] = ids;
    }

    if (!failed && hands.every((h) => Array.isArray(h) && h.length === 2)) {
      return {
        handId: randomUUID(),
        mode,
        seatCount,
        playerOrder,
        hands
      };
    }
  }

  throw new Error("Failed to deal weighted hands after retries");
}

