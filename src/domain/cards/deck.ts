import type { CardType, Rank, Suit } from "./types.js";
import { assert } from "../../utils/assert.js";

const SUITS: Suit[] = ["s", "h", "d", "c"];
const RANKS: Rank[] = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];

export function generateDeck(): CardType[] {
  const deck: CardType[] = [];
  for (const r of RANKS) for (const s of SUITS) deck.push({ rank: r, suit: s });
  return deck;
}

export function cardId(c: CardType): string {
  return `${c.rank}${c.suit}`;
}

export function parseCardId(id: string): CardType {
  assert(typeof id === "string" && id.length === 2, "Invalid card id (expect 2 chars like As)");
  const rank = id[0] as Rank;
  const suit = id[1] as Suit;

  assert((RANKS as string[]).includes(rank), "Invalid rank");
  assert((SUITS as string[]).includes(suit), "Invalid suit");

  return { rank, suit };
}

