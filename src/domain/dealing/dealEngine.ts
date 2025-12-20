import { cardId, parseCardId, generateDeck } from "../cards/deck.js";
import type { CardType } from "../cards/types.js";
import type { DealInput, DealResult } from "./types.js";
import { getPrep } from "./prepCache.js";
import { drawWeightedKey, randInt } from "./sampler.js";

const MAX_RETRY = 128;

function randomUUID(): string {
  // Node 22ならcrypto.randomUUIDがあるはず。なければfallback
  return globalThis.crypto?.randomUUID?.() ?? `H${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

type BoardDealInput = {
  avoid: string[]; // already-used card ids
};

// boardReserved を10枚確定する（重みなしランダム、presetなし）
export function dealBoardReserved(input: BoardDealInput): string[] {
  const { avoid } = input;
  const used = new Set<string>(avoid);
  const board: string[] = [];

  const deck: CardType[] = generateDeck();
  // フィッシャー–イェーツでシャッフル（重み付けなしランダム）
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  for (const c of deck) {
    if (board.length >= 10) break;
    const id = cardId(c);
    if (used.has(id)) continue;
    used.add(id);
    board.push(id);
  }

  if (board.length < 10) {
    throw new Error("Failed to build boardReserved (not enough unique cards).");
  }
  return board;
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
