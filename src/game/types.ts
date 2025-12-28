import type { Card as CardType } from "./cards";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type ActionKind = "fold" | "check" | "call" | "bet" | "raise";

export type PlayerState = {
  hand: CardType[];
  stack: number;
  bet: number;
  folded: boolean;
  allIn: boolean;
};

export type GameState = {
  players: PlayerState[];
  flop: CardType[];
  turn: CardType;
  river: CardType;
  pot: number;
  currentBet: number;
};

export type ActionLogEntry = {
  order: number;
  street: Street;
  playerIndex: number;
  kind: ActionKind;
  amount: number;
  potAfter: number;
  betAfter: number;
  stackAfter: number;
  currentBetAfter: number;
  timestamp: number;
};

export type TableState = {
  game: GameState;
  boardReserved: CardType[];
  street: Street;
  currentPlayer: number;
  roundStarter: number;
  lastAggressor: number | null;
  lastRaise: number;
  btnIndex: number;
  autoWin: number | null;
  revealStreet: Street;
  handId: string;
  handStartedAt: number;
  handEndedAt?: number;
  initialStacks: number[];
  actionLog: ActionLogEntry[];
  matchEnded?: boolean;
};

export type PendingAction = {
  playerIndex: number;
  kind: ActionKind;
  amount?: number;
};

export type Position = "BTN" | "BB" | "UTG" | "CO";
