import {
  type Street,
  type ActionKind,
  type PlayerState,
  type GameState,
  type TableState,
  type PendingAction,
  type ActionLogEntry,
} from "./types";
import {
  getPositions,
  getPreflopOrder,
  getPostflopOrder,
} from "./positions";
import type { Rng } from "./rng";
import { defaultRng } from "./rng";
import { randomUUID } from "crypto";

function findFirstActiveInOrder(order: number[], players: PlayerState[]): number {
  for (const seat of order) {
    const p = players[seat];
    if (p && !p.folded && !p.allIn) return seat;
  }
  return order[0] ?? 0;
}

function nextStreet(street: Street): Street {
  if (street === "preflop") return "flop";
  if (street === "flop") return "turn";
  if (street === "turn") return "river";
  return "showdown";
}

function findNextActiveInOrder(
  order: number[],
  players: PlayerState[],
  current: number
): number {
  const len = order.length;
  const startIdx = order.findIndex((s) => s === current);
  for (let step = 1; step <= len; step++) {
    const idx = order[(startIdx + step) % len];
    const p = players[idx];
    if (!p.folded && !p.allIn) return idx;
  }
  return current;
}

export async function createInitialTable(
  playerCount: number,
  initialStack: number,
  btnIndex: number,
  hands: PlayerState[],
  boardReserved: any[],
  rng: Rng = defaultRng
): Promise<TableState> {
  const preflopOrder = getPreflopOrder(btnIndex, playerCount);

  const flop = boardReserved.slice(0, 3);
  const turn = boardReserved[3];
  const river = boardReserved[4];

  const players: PlayerState[] = hands.map((h, i) => {
    const { bb } = getPositions(btnIndex, playerCount);
    const isBB = i === bb;
    const posted = isBB ? 1 : 0; // BB=1BB
    const stackAfterBlind = Math.max(initialStack - posted, 0);
    return {
      ...h,
      stack: stackAfterBlind,
      bet: posted,
      folded: false,
      allIn: stackAfterBlind === 0 && posted > 0,
    };
  });

  const pot = players.reduce((acc, p) => acc + p.bet, 0);
  const currentBet = 1; // BB posts 1BB
  const firstActor = findFirstActiveInOrder(preflopOrder, players);

  const game: GameState = {
    players,
    flop,
    turn,
    river,
    pot,
    currentBet,
  };

  return {
    game,
    boardReserved,
    street: "preflop",
    currentPlayer: firstActor,
    roundStarter: firstActor,
    lastAggressor: null,
    lastRaise: 1, // BB posted 1BB
    btnIndex,
    autoWin: null,
    revealStreet: "preflop",
    handId: randomUUID(),
    handStartedAt: Date.now(),
    initialStacks: Array(playerCount).fill(initialStack),
    actionLog: [],
  };
}

export function applyAction(
  gameState: TableState,
  action: PendingAction
): TableState {
  const { playerIndex, kind } = action;
  const { game, street } = gameState;

  const players = game.players.map((p) => ({ ...p }));
  const p = players[playerIndex];

  if (street === "showdown" || p.folded || p.allIn) return gameState;

  let pot = game.pot;
  let currentBet = game.currentBet;
  let lastAggressor = gameState.lastAggressor;
  let lastRaise = gameState.lastRaise ?? 1;
  let payAmount = 0;

  switch (kind) {
    case "fold": {
      p.folded = true;
      if (lastAggressor === playerIndex) {
        lastAggressor = null;
      }
      break;
    }
    case "check": {
      break;
    }
    case "call": {
      const toCall = Math.max(0, currentBet - p.bet);
      const pay = Math.min(toCall, p.stack);
      payAmount = pay;
      p.stack -= pay;
      p.bet += pay;
      pot += pay;
      if (p.stack === 0) p.allIn = true;
      break;
    }
    case "bet":
    case "raise": {
      const maxTotal = p.bet + p.stack;
      const desiredTotal =
        action.amount !== undefined ? Math.max(0, action.amount) : p.bet;

      if (currentBet === 0) {
        const minBet = 1;
        const targetTotal = Math.min(Math.max(desiredTotal, minBet), maxTotal);
        const pay = Math.max(0, targetTotal - p.bet);
        payAmount = pay;
        p.stack -= pay;
        p.bet += pay;
        pot += pay;
        currentBet = p.bet;
        lastRaise = currentBet;
        if (p.stack === 0) p.allIn = true;
        lastAggressor = playerIndex;
      } else {
        const minRaiseTotal = Math.max(currentBet + lastRaise, currentBet + 1);
        const targetTotal = Math.min(
          Math.max(desiredTotal, minRaiseTotal),
          maxTotal
        );
        const pay = Math.max(0, targetTotal - p.bet);
        payAmount = pay;
        p.stack -= pay;
        p.bet += pay;
        pot += pay;
        const raiseSize = p.bet - currentBet;
        if (raiseSize >= lastRaise) {
          lastRaise = raiseSize;
          currentBet = p.bet;
          lastAggressor = playerIndex;
        } else {
          currentBet = Math.max(currentBet, p.bet);
        }
        if (p.stack === 0) p.allIn = true;
      }
      break;
    }
  }

  return {
    ...gameState,
    game: { ...game, players, pot, currentBet },
    lastAggressor,
    lastRaise,
    revealStreet: gameState.revealStreet,
    actionLog: [
      ...gameState.actionLog,
      {
        order: gameState.actionLog.length,
        street,
        playerIndex,
        kind,
        amount: payAmount,
        potAfter: pot,
        betAfter: p.bet,
        stackAfter: p.stack,
        currentBetAfter: currentBet,
        timestamp: Date.now(),
      },
    ],
  };
}

export function advanceAfterAction(state: TableState): TableState {
  let { game, street, currentPlayer, roundStarter, lastAggressor } = state;
  const players = game.players;
  const preflopOrder = getPreflopOrder(state.btnIndex, players.length);
  const postflopOrder = getPostflopOrder(state.btnIndex, players.length);
  const actionOrder = street === "preflop" ? preflopOrder : postflopOrder;
  const nextStreetOrder = street === "preflop" ? postflopOrder : postflopOrder;

  if (
    players[roundStarter]?.folded === true ||
    players[roundStarter]?.allIn === true
  ) {
    roundStarter = findFirstActiveInOrder(actionOrder, players);
  }

  const activeNotFolded = players.filter((p) => !p.folded);

  if (
    activeNotFolded.length > 0 &&
    activeNotFolded.every((p) => p.allIn)
  ) {
    return { ...state, street: "showdown" };
  }

  const activeIndices = players
    .map((p, i) => (!p.folded ? i : -1))
    .filter((i) => i !== -1);

  if (activeIndices.length <= 1) {
    const winner = activeIndices[0] ?? 0;
    return { ...state, street: "showdown", autoWin: winner };
  }

  const nextIndex = findNextActiveInOrder(actionOrder, players, currentPlayer);

  const everyoneMatchedOrAllIn = players
    .filter((p) => !p.folded)
    .every((p) => p.allIn || p.bet === game.currentBet);
  const effectiveStarter =
    players[roundStarter] && !players[roundStarter].folded && !players[roundStarter].allIn
      ? roundStarter
      : findFirstActiveInOrder(actionOrder, players);
  const cameFullCircleStarter = nextIndex === effectiveStarter;
  const cameBackToAggressor =
    lastAggressor !== null ? nextIndex === lastAggressor : cameFullCircleStarter;

  if (game.currentBet === 0) {
    if (cameFullCircleStarter) {
      const ns = nextStreet(street);
      if (ns === "showdown") return { ...state, street: "showdown", revealStreet: street };
      const resetPlayers = players.map((p) => ({ ...p, bet: 0 }));
      const firstActive = findFirstActiveInOrder(nextStreetOrder, resetPlayers);
      return {
        ...state,
        game: { ...game, players: resetPlayers, currentBet: 0 },
        street: ns,
        currentPlayer: firstActive,
        roundStarter: firstActive,
        lastAggressor: null,
        lastRaise: 1,
        revealStreet: ns,
        autoWin: null,
      };
    } else {
      return { ...state, currentPlayer: nextIndex, roundStarter: effectiveStarter };
    }
  }

  if (everyoneMatchedOrAllIn && cameBackToAggressor) {
    const ns = nextStreet(street);
    if (ns === "showdown") return { ...state, street: "showdown" };
    const resetPlayers = players.map((p) => ({ ...p, bet: 0 }));
    const firstActive = findFirstActiveInOrder(nextStreetOrder, resetPlayers);
    return {
      ...state,
      game: { ...game, players: resetPlayers, currentBet: 0 },
      street: ns,
      currentPlayer: firstActive,
      roundStarter: firstActive,
      lastAggressor: null,
      lastRaise: 1,
      revealStreet: ns,
      autoWin: null,
    };
  }

  return { ...state, currentPlayer: nextIndex, roundStarter: effectiveStarter };
}

export function makeActionLabel(
  kind: ActionKind,
  table: TableState,
  playerIndex: number
): string {
  const p = table.game.players[playerIndex];
  const toCall = Math.max(0, table.game.currentBet - p.bet);
  const wouldAllInCall = kind === "call" && toCall >= p.stack && p.stack > 0;

  if ((kind === "bet" || kind === "raise") && p.stack > 0) {
    const isAllIn = p.stack + p.bet <= table.game.currentBet || p.stack === 0;
    if (isAllIn) {
      return `All-in (${p.stack}BB)`;
    }
  }
  if (wouldAllInCall) {
    return `All-in (${p.stack}BB)`;
  }

  switch (kind) {
    case "fold":
      return "Fold";
    case "check":
      return "Check";
    case "call":
      return `Call (${toCall}BB)`;
    case "bet":
      return "Bet";
    case "raise":
      return "Raise";
  }
}

export type { Street, ActionKind, PlayerState, GameState, TableState, PendingAction };

