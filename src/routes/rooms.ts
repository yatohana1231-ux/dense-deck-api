import type { FastifyInstance } from "fastify";
import {
  listRooms,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  startRoom,
  verifyRoomPassword,
  rebuy,
} from "../domain/rooms.js";
import { assert } from "../utils/assert.js";
import { loadUserFromSession } from "../utils/auth.js";
import { startHand, applyPlayerAction, getInHandState } from "../domain/handEngine.js";
import { setSeatConnection } from "../domain/rooms.js";


async function requireAuth(request: any, reply: any) {
  const user = await loadUserFromSession(request, reply);
  if (!user) {
    reply.code(401).send({ message: "Unauthorized" });
    return null;
  }
  return user;
}

export async function registerRoomRoutes(app: FastifyInstance) {
  // ルーム一覧
  app.get("/api/rooms", async (_req, reply) => {
    return reply.send({ rooms: listRooms() });
  });

  // ルーム作成
  app.post("/api/rooms", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const body = (req.body ?? {}) as {
      name?: string;
      password?: string;
      tag?: string;
      config?: { initialStackBB?: number; actionSeconds?: number; reconnectGraceSeconds?: number; rebuyAmount?: number };
    };
    const room = await createRoom({
      name: body.name,
      password: body.password,
      tag: (body.tag as any) ?? "未設定",
      config: body.config,
    });
    // 作成者も参加させる
    joinRoom(room, {
      userId: user.userId,
      username: user.username ?? "Player",
      stack: room.config.initialStackBB,
      isSittingOut: false,
      seatIndex: room.seats.length,
      isConnected: true,
    });
    return reply.send({ room });
  });

  // 参加
  app.post("/api/rooms/:id/join", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const body = (req.body ?? {}) as { password?: string };
    const okPw = await verifyRoomPassword(room, body.password);
    if (!okPw) return reply.code(403).send({ message: "password mismatch" });
    const ok = joinRoom(room, {
      userId: user.userId,
      username: user.username ?? "Player",
      stack: room.config.initialStackBB,
      isSittingOut: false,
      seatIndex: room.seats.length,
      isConnected: true,
    });
    if (!ok) return reply.code(400).send({ message: "cannot join" });
    return reply.send({ room });
  });

  // 退室
  app.post("/api/rooms/:id/leave", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const ok = leaveRoom(room, user.userId);
    if (!ok) return reply.code(400).send({ message: "not in room" });
    return reply.send({ ok: true });
  });

  // 開始（WAITING -> STARTING -> IN_HAND の起点。実際の配牌/進行は別途実装予定）
  app.post("/api/rooms/:id/start", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const ok = startRoom(room);
    if (!ok) return reply.code(400).send({ message: "cannot start" });
    // 簡易: 手動でIN_HANDに遷移し、ハンド開始
    room.state = "IN_HAND";
    startHand(room);
    return reply.send({ room });
  });

  // Rebuy（破産時のスタック追加。UI で確認後に叩く想定）
  app.post("/api/rooms/:id/rebuy", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const body = (req.body ?? {}) as { amount?: number };
    assert(typeof body.amount === "number" && body.amount > 0, "amount required");
    const ok = rebuy(room, user.userId, body.amount);
    if (!ok) return reply.code(400).send({ message: "cannot rebuy" });
    return reply.send({ room });
  });

  // アクション（MVP版: 検証は簡易）
  app.post("/api/rooms/:id/action", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const body = (req.body ?? {}) as { playerIndex?: number; kind?: string; amount?: number };
    assert(typeof body.playerIndex === "number", "playerIndex required");
    assert(typeof body.kind === "string", "kind required");
    const kind = body.kind as any;
    const state = applyPlayerAction(room, {
      playerIndex: body.playerIndex,
      kind,
      amount: body.amount,
    });
    if (!state) return reply.code(400).send({ message: "no hand in progress" });
    return reply.send({ state });
  });

  // ハートビート
  app.post("/api/rooms/:id/heartbeat", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const room = getRoom((req.params as any).id);
    if (!room) return reply.code(404).send({ message: "room not found" });
    const state = getInHandState(room.id);
    if (state) {
      state.lastSeen.set(user.userId, Date.now());
    }
    setSeatConnection(room, user.userId, true);
    reply.send({ ok: true });
  });
}
