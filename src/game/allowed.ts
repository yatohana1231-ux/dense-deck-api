import type { ActionKind, TableState } from "./types";

export function getLegalActions(table: TableState, playerIndex: number): ActionKind[] {
  const p = table.game.players[playerIndex];
  if (!p || p.folded || p.allIn) return [];

  const toCall = Math.max(0, table.game.currentBet - p.bet);
  const canCheck = toCall === 0;
  const actions: ActionKind[] = [];
  actions.push("fold");
  if (canCheck) {
    actions.push("check");
    if (p.stack > 0) actions.push("bet");
  } else {
    actions.push("call");
    if (p.stack > toCall) actions.push("raise");
  }
  return actions;
}

export function isValidBetOrRaise(
  table: TableState,
  playerIndex: number,
  amount: number
): boolean {
  const p = table.game.players[playerIndex];
  if (!p || p.folded || p.allIn) return false;
  const maxTotal = p.bet + p.stack;
  const desired = Math.max(0, amount);
  if (desired > maxTotal) return false;

  // bet
  if (table.game.currentBet === 0) {
    const minBet = 1;
    return desired >= minBet;
  }

  // raise
  const lastRaise = table.lastRaise ?? 1;
  const minRaiseTotal = Math.max(
    table.game.currentBet + lastRaise,
    table.game.currentBet + 1
  );
  return desired >= minRaiseTotal;
}
