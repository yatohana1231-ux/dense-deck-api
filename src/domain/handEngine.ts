import { EventEmitter } from "events";
import type { Room } from "./rooms.js";
import {
  type PendingAction,
  type TableState,
  applyAction,
  advanceAfterAction,
  createInitialTable,
} from "../game/table.js";
import { fullDeck } from "../game/cards.js";
import { defaultRng } from "../game/rng.js";
import { getLegalActions, isValidBetOrRaise } from "../game/allowed.js";
import type { ActionKind } from "../game/types.js";
import { evaluateBestOfSeven, compareHandValues } from "../game/handEval.js";

export type InHandState = {
  roomId: string;
  table: TableState;
  actionDeadline: number;
  lastSeen: Map<string, number>;
  handEnded: boolean;
  handSettled?: { winners: number[]; pot: number };
};

const inHandStore = new Map<string, InHandState>();
const handEvents = new EventEmitter();
const actionTimers = new Map<string, NodeJS.Timeout>();

export function getInHandState(roomId: string) {
  return inHandStore.get(roomId);
}

export function setInHandState(state: InHandState) {
  inHandStore.set(state.roomId, state);
  handEvents.emit("state", state);
}

export function clearInHandState(roomId: string) {
  inHandStore.delete(roomId);
  handEvents.emit("clear", roomId);
  const t = actionTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    actionTimers.delete(roomId);
  }
}

export function onHandState(roomId: string, fn: (s: InHandState) => void) {
  const h = (s: InHandState) => {
    if (s.roomId === roomId) fn(s);
  };
  handEvents.on("state", h);
  return () => handEvents.off("state", h);
}

export function onHandClear(roomId: string, fn: () => void) {
  const h = (id: string) => {
    if (id === roomId) fn();
  };
  handEvents.on("clear", h);
  return () => handEvents.off("clear", h);
}

function shuffle<T>(arr: T[], rng = defaultRng): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export async function startHand(room: Room) {
  const rng = defaultRng;
  const deck = shuffle(fullDeck, rng);
  const playerCount = room.seats.length;
  const btnIndex = room.btnIndex % Math.max(playerCount, 1);
  room.btnIndex = (room.btnIndex + 1) % Math.max(playerCount, 1);
  const hands = Array.from({ length: playerCount }).map((_, i) => {
    const c1 = deck[i * 2];
    const c2 = deck[i * 2 + 1];
    return { hand: [c1, c2], stack: room.seats[i].stack, bet: 0, folded: false, allIn: false };
  });
  const boardReserved = deck.slice(playerCount * 2, playerCount * 2 + 5);
  const table = await createInitialTable(
    playerCount,
    room.config.initialStackBB,
    btnIndex,
    hands,
    boardReserved,
    rng
  );
  const deadline = Date.now() + room.config.actionSeconds * 1000;
  const state: InHandState = {
    roomId: room.id,
    table,
    actionDeadline: deadline,
    lastSeen: new Map(room.seats.map((s) => [s.userId, Date.now()])),
    handEnded: false,
  };
  setInHandState(state);
  scheduleDeadline(room);
  return state;
}

// Apply an action and advance turn. MVP版の簡易実装：ターン/レイズ可否は最低限。
export function applyPlayerAction(
  room: Room,
  action: PendingAction
): InHandState | undefined {
  const state = inHandStore.get(room.id);
  if (!state) return undefined;
  // ターンプレイヤーか
  if (state.table.currentPlayer !== action.playerIndex) return undefined;
  // レーガルチェック
  const legal = getLegalActions(state.table, action.playerIndex);
  if (!legal.includes(action.kind as any)) return undefined;
  if (action.kind === "bet" || action.kind === "raise") {
    const amt = action.amount;
    if (amt === undefined) return undefined;
    if (!isValidBetOrRaise(state.table, action.playerIndex, amt)) return undefined;
  }

  const nextTable = advanceAfterAction(applyAction(state.table, action));
  const nextDeadline = Date.now() + room.config.actionSeconds * 1000;
  const nextState = {
    ...state,
    table: nextTable,
    actionDeadline: nextDeadline,
    lastSeen: new Map(state.lastSeen).set(
      room.seats[action.playerIndex]?.userId ?? "",
      Date.now()
    ),
  };
  setInHandState(nextState);
  scheduleDeadline(room);
  return nextState;
}

export function settleHand(room: Room, table: TableState) {
  const winners: number[] =
    table.autoWin !== null
      ? [table.autoWin]
      : computeShowdownWinners(table);
  const pot = table.game.pot;
  const share = winners.length > 0 ? Math.floor(pot / winners.length) : 0;
  const remainder = winners.length > 0 ? pot % winners.length : 0;

  const newPlayers = table.game.players.map((p, idx) => {
    if (!winners.includes(idx)) return p;
    return { ...p, stack: p.stack + share + (idx === winners[0] ? remainder : 0) };
  });

  newPlayers.forEach((p, idx) => {
    const seat = room.seats[idx];
    if (seat) {
      seat.stack = p.stack;
    }
  });

  // clearInHandState(room.id);  <-- ここは一旦削除（手札をhandEndedで保持）
  const endedState = inHandStore.get(room.id);
  if (endedState) {
    setInHandState({
      ...endedState,
      handEnded: true,
      handSettled: { winners, pot },
      table: table, // endedTableではなく table を使う
    });
  }
  room.state = "WAITING";
  handEvents.emit("handSettled", { roomId: room.id, winners, pot });
}

function computeShowdownWinners(table: TableState): number[] {
  const board = [...table.game.flop, table.game.turn, table.game.river];
  let best: ReturnType<typeof evaluateBestOfSeven> | null = null;
  let winners: number[] = [];
  table.game.players.forEach((p, idx) => {
    if (p.folded) return;
    const v = evaluateBestOfSeven(p.hand, board);
    if (!best) {
      best = v;
      winners = [idx];
    } else {
      const cmp = compareHandValues(v, best);
      if (cmp > 0) {
        best = v;
        winners = [idx];
      } else if (cmp === 0) {
        winners.push(idx);
      }
    }
  });
  return winners.length > 0 ? winners : [0];
}

function scheduleDeadline(room: Room) {
  const state = inHandStore.get(room.id);
  if (!state) return;
  const existing = actionTimers.get(room.id);
  if (existing) clearTimeout(existing);
  const now = Date.now();
  const delay = Math.max(0, state.actionDeadline - now);
  const t = setTimeout(() => {
    const st = inHandStore.get(room.id);
    if (!st) return;
    if (st.actionDeadline !== state.actionDeadline) return; // already advanced

    // 接続猶予超過なら autoFold/autoCheck
    const table1 = st.table;
    const player1 = table1.currentPlayer;
    const seat = room.seats[player1];
    const lastSeen = st.lastSeen.get(seat?.userId ?? "") ?? 0;
    const graceMs = room.config.reconnectGraceSeconds * 1000;
    const nowTs = Date.now();
    if (nowTs - lastSeen > graceMs) {
      const legal = getLegalActions(table1, player1);
      let kind: ActionKind = "fold";
      if (legal.includes("check")) kind = "check";
      applyPlayerAction(room, { playerIndex: player1, kind });
      return;
    }

    // 通常タイムアウト
    const table2 = st.table;
    const player2 = table2.currentPlayer;
    const legal = getLegalActions(table2, player2);
    let kind: ActionKind = "fold";
    if (legal.includes("check")) {
      kind = "check";
    } else if (legal.includes("fold")) {
      kind = "fold";
    }
    applyPlayerAction(room, { playerIndex: player2, kind });
  }, delay);

  actionTimers.set(room.id, t);
}
