import crypto from "crypto";
import bcrypt from "bcryptjs";
import { EventEmitter } from "events";

export type RoomState = "WAITING" | "STARTING" | "IN_HAND" | "CLOSED";

export type RoomTag = "初見歓迎" | "真剣勝負" | "未設定";

export type RoomConfig = {
  initialStackBB: number;
  actionSeconds: number;
  reconnectGraceSeconds: number;
  rebuyAmount: number;
};

export type RoomSeat = {
  userId: string;
  username: string;
  stack: number;
  isSittingOut: boolean;
  seatIndex: number;
  isConnected: boolean;
};

export type Room = {
  id: string;
  name: string;
  state: RoomState;
  tag: RoomTag;
  hasPassword: boolean;
  passwordHash?: string;
  seats: RoomSeat[];
  maxSeats: number;
  config: RoomConfig;
  createdAt: number;
  btnIndex: number;
};

const rooms = new Map<string, Room>();
const roomEvents = new EventEmitter();

const DEFAULT_CONFIG: RoomConfig = {
  initialStackBB: 200,
  actionSeconds: 60,
  reconnectGraceSeconds: 60,
  rebuyAmount: 200,
};

export function listRooms(): Room[] {
  return Array.from(rooms.values()).filter((r) => r.state !== "CLOSED");
}

export async function createRoom(params: {
  name?: string;
  password?: string;
  tag?: RoomTag;
  config?: Partial<RoomConfig>;
}): Promise<Room> {
  const id = crypto.randomUUID();
  const passwordHash = params.password ? await bcrypt.hash(params.password, 8) : undefined;
  const tag = params.tag ?? "未設定";
  const config: RoomConfig = {
    initialStackBB: params.config?.initialStackBB ?? DEFAULT_CONFIG.initialStackBB,
    actionSeconds: params.config?.actionSeconds ?? DEFAULT_CONFIG.actionSeconds,
    reconnectGraceSeconds: params.config?.reconnectGraceSeconds ?? DEFAULT_CONFIG.reconnectGraceSeconds,
    rebuyAmount: params.config?.rebuyAmount ?? DEFAULT_CONFIG.rebuyAmount,
  };
  const room: Room = {
    id,
    name: params.name ?? `Room-${id.slice(0, 6)}`,
    state: "WAITING",
    tag,
    hasPassword: !!params.password,
    passwordHash,
    seats: [],
    maxSeats: 4,
    config,
    createdAt: Date.now(),
    btnIndex: 0,
  };
  rooms.set(id, room);
  roomEvents.emit("roomUpdate", room);
  return room;
}

export async function verifyRoomPassword(room: Room, password?: string): Promise<boolean> {
  if (!room.hasPassword) return true;
  if (!password) return false;
  if (!room.passwordHash) return false;
  return bcrypt.compare(password, room.passwordHash);
}

export function getRoom(id: string): Room | undefined {
  return rooms.get(id);
}

export function joinRoom(room: Room, seat: RoomSeat): boolean {
  if (room.state !== "WAITING") return false;
  if (room.seats.find((s) => s.userId === seat.userId)) return true;
  if (room.seats.length >= room.maxSeats) return false;
  room.seats.push(seat);
  roomEvents.emit("roomUpdate", room);
  return true;
}

export function leaveRoom(room: Room, userId: string): boolean {
  const idx = room.seats.findIndex((s) => s.userId === userId);
  if (idx === -1) return false;
  room.seats.splice(idx, 1);
  if (room.seats.length === 0) {
    room.state = "CLOSED";
  } else if (room.state === "IN_HAND") {
    // 待機へ戻す
    room.state = "WAITING";
  }
  roomEvents.emit("roomUpdate", room);
  return true;
}

export function startRoom(room: Room): boolean {
  if (room.state !== "WAITING") return false;
  if (room.seats.length < 2) return false;
  room.state = "STARTING";
  roomEvents.emit("roomUpdate", room);
  return true;
}

// Rebuy：スタックを加算する。拒否なら leaveRoom と組み合わせて利用。
export function rebuy(room: Room, userId: string, amount: number): boolean {
  const seat = room.seats.find((s) => s.userId === userId);
  if (!seat) return false;
  seat.stack += amount;
  roomEvents.emit("roomUpdate", room);
  return true;
}

// 簡易リセット（手動または IN_HAND→WAITING のタイミングなどで呼ぶ想定）
export function markRoomWaiting(room: Room) {
  room.state = "WAITING";
  roomEvents.emit("roomUpdate", room);
}

export function onRoomUpdate(fn: (room: Room) => void) {
  roomEvents.on("roomUpdate", fn);
  return () => roomEvents.off("roomUpdate", fn);
}

export function setSeatConnection(room: Room, userId: string, connected: boolean) {
  const seat = room.seats.find((s) => s.userId === userId);
  if (seat) {
    seat.isConnected = connected;
    roomEvents.emit("roomUpdate", room);
  }
}
