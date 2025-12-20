import type { FastifyInstance } from "fastify";
import { assert } from "../utils/assert.js";
import type { Mode } from "../domain/dealing/types.js";
import { dealHands, dealBoardReserved } from "../domain/dealing/dealEngine.js";

type DealRequest = {
  seatCount?: number;
  playerOrder?: number[];
  mode?: Mode;
};

export async function registerDealRoutes(app: FastifyInstance) {
  app.post("/api/deal", async (req, reply) => {
    const body = (req.body ?? {}) as DealRequest;

    const mode: Mode = body.mode ?? "dense";

    const seatCountRaw = body.seatCount ?? 2;
    const seatCount = Math.max(2, Math.min(8, Number(seatCountRaw)));

    const playerOrder = body.playerOrder ?? Array.from({ length: seatCount }, (_, i) => i);

    // validate
    assert(Array.isArray(playerOrder), "playerOrder must be array");
    assert(playerOrder.length === seatCount, "playerOrder length mismatch");

    const set = new Set<number>();
    for (const s of playerOrder) {
      assert(Number.isInteger(s), "playerOrder must be integer seats");
      assert(s >= 0 && s < seatCount, "playerOrder out of range");
      assert(!set.has(s), "playerOrder has duplicates");
      set.add(s);
    }

    // boardReserved はサーバ側で10枚ランダム生成（リクエストでは受け取らない）
    const ensuredBoard = dealBoardReserved({ avoid: [] });

    // boardReserved と重複しないようにハンドを配布。
    const result = dealHands({
      seatCount,
      playerOrder,
      boardReserved: ensuredBoard,
      mode
    });

    return reply.send({
      ...result,
      boardReserved: ensuredBoard,
    });
  });
}
