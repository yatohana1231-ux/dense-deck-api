import type { FastifyInstance } from "fastify";
import { prisma } from "../utils/prisma.js";
import { assert } from "../utils/assert.js";
import { loadUserFromSession } from "../utils/auth.js";

type SaveHistoryRequest = {
  handId: string;
  tableId: string;
  playerId?: string;
  playedAt?: string; // ISO string
  mode: string;
  stakes: { sb: number; bb: number };
  heroSeat: number;
  heroNetResult?: number | string;
  winnerCount?: number;
  autoWin?: boolean | number | null;
  payload?: unknown;
};

const toNumber = (v: unknown, fallback = 0) => {
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function mapHandRow(row: any) {
  return {
    handId: row.hand_id,
    tableId: row.table_id,
    playerId: row.player_id ?? null,
    playedAt: row.played_at?.toISOString?.() ?? row.played_at,
    mode: row.mode,
    stakes: { sb: row.stakes_sb, bb: row.stakes_bb },
    heroSeat: row.hero_seat,
    heroNetResult: toNumber(row.hero_net_result),
    winnerCount: row.winner_count,
    autoWin: row.auto_win,
    payload: row.payload ?? null,
  };
}

export async function registerHistoryRoutes(app: FastifyInstance) {
  // Save a hand record (minimal columns defined in Prisma schema)
  app.post("/api/history", async (req, reply) => {
    const user = await loadUserFromSession(req, reply);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    const body = (req.body ?? {}) as SaveHistoryRequest;

    assert(typeof body.handId === "string" && body.handId.length > 0, "handId required");
    assert(typeof body.tableId === "string" && body.tableId.length > 0, "tableId required");
    assert(typeof body.mode === "string" && body.mode.length > 0, "mode required");
    assert(typeof body.stakes?.sb === "number", "stakes.sb required");
    assert(typeof body.stakes?.bb === "number", "stakes.bb required");
    assert(Number.isInteger(body.heroSeat), "heroSeat required");

    const playedAt = body.playedAt ? new Date(body.playedAt) : new Date();
    if (Number.isNaN(playedAt.getTime())) {
      throw new Error("playedAt is invalid");
    }

    const created = await prisma.hand_records.create({
      data: {
        hand_id: body.handId,
        table_id: body.tableId,
        player_id: body.playerId ?? null,
        played_at: playedAt,
        mode: body.mode,
        stakes_sb: Math.trunc(body.stakes.sb),
        stakes_bb: Math.trunc(body.stakes.bb),
        hero_seat: body.heroSeat,
        hero_net_result: BigInt(body.heroNetResult ?? 0),
        winner_count: Math.trunc(body.winnerCount ?? 0),
        auto_win: Boolean(body.autoWin ?? false),
        payload: body.payload ?? {},
        user_id: user.userId,
      },
    });

    return reply.send(mapHandRow(created));
  });

  // List recent hand records
  app.get("/api/history", async (req, reply) => {
    const user = await loadUserFromSession(req, reply);
    if (!user) return reply.code(401).send({ message: "Unauthorized" });
    const query = req.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query?.limit ?? 10), 1), 100);

    const rows = await prisma.hand_records.findMany({
      take: limit,
      orderBy: [{ played_at: "desc" }, { hand_id: "desc" }],
      where: { user_id: user.userId },
    });
    return reply.send(rows.map(mapHandRow));
  });
}
