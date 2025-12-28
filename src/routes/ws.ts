import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";
import { listRooms, onRoomUpdate, getRoom } from "../domain/rooms.js";
import { onHandState, onHandClear, getInHandState } from "../domain/handEngine.js";

export async function registerWsRoutes(app: FastifyInstance) {
  // ルーム一覧配信用
  app.get("/ws/rooms", { websocket: true }, (connection) => {
    const ws = connection.socket as WebSocket;
    const send = (data: any) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    send({ type: "rooms", rooms: listRooms() });

    const unsub = onRoomUpdate(() => {
      send({ type: "rooms", rooms: listRooms() });
    });

    ws.on("close", () => {
      unsub();
    });
  });

  // 単一ルーム + 進行中ハンド配信用
  app.get("/ws/rooms/:id", { websocket: true }, (connection, req) => {
    const ws = connection.socket as WebSocket;
    const roomId = (req.params as any).id as string;
    const send = (data: any) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(data));
      }
    };

    const room = getRoom(roomId);
    if (room) {
      send({ type: "room", room });
    } else {
      send({ type: "error", message: "room not found" });
    }

    const hand = getInHandState(roomId);
    if (hand) {
      send({ type: "game", state: hand });
    }

    const unsubRoom = onRoomUpdate((updated) => {
      if (updated.id === roomId) {
        send({ type: "room", room: updated });
      }
    });
    const unsubHand = onHandState(roomId, (state) => {
      send({ type: "game", state });
    });
    const unsubClear = onHandClear(roomId, () => send({ type: "gameClear" }));

    ws.on("close", () => {
      unsubRoom();
      unsubHand();
      unsubClear();
    });
  });
}
