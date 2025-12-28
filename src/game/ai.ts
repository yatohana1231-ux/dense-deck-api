import type { ActionKind, TableState } from "./types";
import { getLegalActions } from "./allowed";

export function pickAiAction(table: TableState, playerIndex: number): ActionKind {
  const legal = getLegalActions(table, playerIndex);
  if (legal.includes("check")) return "check";
  if (legal.includes("call")) return "call";
  return legal[0] ?? "fold";
}
