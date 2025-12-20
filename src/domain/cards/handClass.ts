import type { CardType, Rank } from "./types.js";

const RANK_ORDER: Record<Rank, number> = {
  A: 12, K: 11, Q: 10, J: 9, T: 8,
  "9": 7, "8": 6, "7": 5, "6": 4, "5": 3, "4": 2, "3": 1, "2": 0
};

function sortRanksDesc(a: Rank, b: Rank): [Rank, Rank] {
  return RANK_ORDER[a] >= RANK_ORDER[b] ? [a, b] : [b, a];
}

/**
 * 169クラスキーを返す: "AA", "AKs", "AKo" など
 */
export function getHandClass(c1: CardType, c2: CardType): string {
  if (c1.rank === c2.rank) return `${c1.rank}${c2.rank}`;
  const [hi, lo] = sortRanksDesc(c1.rank, c2.rank);
  const suited = c1.suit === c2.suit;
  return `${hi}${lo}${suited ? "s" : "o"}`;
}

