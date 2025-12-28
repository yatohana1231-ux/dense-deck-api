import type { Card as CardType } from "./cards";

export type HandCategory =
  | "high-card"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";

export type HandValue = {
  category: HandCategory;
  categoryIndex: number;
  ranks: string[];
  cards: CardType[];
};

const rankOrder = "23456789TJQKA";

function rankValue(rank: string): number {
  return rankOrder.indexOf(rank);
}

function compareHighCard(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = rankValue(a[i] ?? "2");
    const bv = rankValue(b[i] ?? "2");
    if (av !== bv) return av - bv;
  }
  return 0;
}

function isStraight(ranks: string[]): string[] | null {
  const unique = Array.from(new Set(ranks)).sort((a, b) => rankValue(a) - rankValue(b));
  // Wheel straight A5432
  const wheel = ["A", "5", "4", "3", "2"];
  if (wheel.every((r) => unique.includes(r))) return ["5", "4", "3", "2", "A"];
  for (let i = unique.length - 5; i >= 0; i--) {
    const slice = unique.slice(i, i + 5);
    const isSeq =
      rankValue(slice[4]) - rankValue(slice[0]) === 4 &&
      new Set(slice).size === 5;
    if (isSeq) return slice.slice().reverse(); // high to low
  }
  return null;
}

export function evaluateBestOfSeven(hand: CardType[], board: CardType[]): HandValue {
  const cards = [...hand, ...board];
  const bySuit: Record<string, CardType[]> = {};
  const counts: Record<string, number> = {};
  cards.forEach((c) => {
    counts[c.rank] = (counts[c.rank] ?? 0) + 1;
    bySuit[c.suit] = bySuit[c.suit] ?? [];
    bySuit[c.suit].push(c);
  });
  // Flush?
  let flushCards: CardType[] | null = null;
  Object.values(bySuit).forEach((arr) => {
    if (arr.length >= 5) {
      flushCards = arr
        .sort((a, b) => rankValue(b.rank) - rankValue(a.rank))
        .slice(0, 5);
    }
  });

  // Straight?
  const sortedRanks = cards
    .map((c) => c.rank)
    .sort((a, b) => rankValue(b) - rankValue(a));
  const straightRanks = isStraight(sortedRanks);

  // Straight flush?
  if (flushCards && (flushCards as CardType[]).length > 0) {
    const sfRanks = isStraight((flushCards as CardType[]).map((c) => c.rank));
    if (sfRanks) {
      return {
        category: "straight-flush",
        categoryIndex: 8,
        ranks: sfRanks,
        cards: flushCards,
      };
    }
  }

  // Four of a kind?
  const fours = Object.entries(counts)
    .filter(([, v]) => v === 4)
    .map(([r]) => r)
    .sort((a, b) => rankValue(b) - rankValue(a));
  if (fours.length > 0) {
    const kicker = sortedRanks.find((r) => r !== fours[0]) ?? "2";
    return {
      category: "four-of-a-kind",
      categoryIndex: 7,
      ranks: [fours[0], kicker],
      cards,
    };
  }

  // Full house?
  const trips = Object.entries(counts)
    .filter(([, v]) => v === 3)
    .map(([r]) => r)
    .sort((a, b) => rankValue(b) - rankValue(a));
  const pairs = Object.entries(counts)
    .filter(([, v]) => v === 2)
    .map(([r]) => r)
    .sort((a, b) => rankValue(b) - rankValue(a));
  if (trips.length > 0 && (pairs.length > 0 || trips.length > 1)) {
    const tripRank = trips[0];
    const pairRank = pairs[0] ?? trips[1];
    return {
      category: "full-house",
      categoryIndex: 6,
      ranks: [tripRank, pairRank],
      cards,
    };
  }

  // Flush?
  if (flushCards && (flushCards as CardType[]).length > 0) {
    return {
      category: "flush",
      categoryIndex: 5,
      ranks: (flushCards as CardType[]).map((c) => c.rank),
      cards: flushCards as CardType[],
    };
  }

  // Straight?
  if (straightRanks) {
    return {
      category: "straight",
      categoryIndex: 4,
      ranks: straightRanks,
      cards,
    };
  }

  // Trips?
  if (trips.length > 0) {
    const kickers = sortedRanks.filter((r) => r !== trips[0]).slice(0, 2);
    return {
      category: "three-of-a-kind",
      categoryIndex: 3,
      ranks: [trips[0], ...kickers],
      cards,
    };
  }

  // Two pair?
  if (pairs.length >= 2) {
    const top2 = pairs.slice(0, 2);
    const kicker = sortedRanks.filter((r) => !top2.includes(r))[0] ?? "2";
    return {
      category: "two-pair",
      categoryIndex: 2,
      ranks: [...top2, kicker],
      cards,
    };
  }

  // One pair?
  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = sortedRanks.filter((r) => r !== pair).slice(0, 3);
    return {
      category: "one-pair",
      categoryIndex: 1,
      ranks: [pair, ...kickers],
      cards,
    };
  }

  // High card
  return {
    category: "high-card",
    categoryIndex: 0,
    ranks: sortedRanks.slice(0, 5),
    cards,
  };
}

export function compareHandValues(a: HandValue, b: HandValue): number {
  if (a.categoryIndex !== b.categoryIndex) return a.categoryIndex - b.categoryIndex;
  return compareHighCard(a.ranks, b.ranks);
}
