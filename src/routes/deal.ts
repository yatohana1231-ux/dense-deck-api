import type { FastifyInstance } from "fastify";
import { assert } from "../utils/assert.js";
import type { Mode } from "../domain/dealing/types.js";
import { dealHands, dealBoardReserved } from "../domain/dealing/dealEngine.js";
import { parseCardId, cardId } from "../domain/cards/deck.js";

type DealRequest = {
  seatCount?: number;
  playerOrder?: number[];
  boardReserved?: string[]; // "As" 等
  mode?: Mode;
};

export async function registerDealRoutes(app: FastifyInstance) {
  app.post("/api/deal", async (req, reply) => {
    const body = (req.body ?? {}) as DealRequest;

    const mode: Mode = body.mode ?? "dense";

    const seatCountRaw = body.seatCount ?? 2;
    const seatCount = Math.max(2, Math.min(8, Number(seatCountRaw)));

    const playerOrder = body.playerOrder ?? Array.from({ length: seatCount }, (_, i) => i);
    const boardReserved = body.boardReserved ?? [];

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

    assert(Array.isArray(boardReserved), "boardReserved must be array");

    // boardReserved を10枚確定。リクエストが不足していればサーバ側で生成。
    let ensuredBoard = boardReserved;
    if (!Array.isArray(ensuredBoard) || ensuredBoard.length < 10) {
      ensuredBoard = dealBoardReserved({ preset: boardReserved, avoid: [] });
    } else {
      ensuredBoard = ensuredBoard.map((id) => cardId(parseCardId(id)));
    }

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
