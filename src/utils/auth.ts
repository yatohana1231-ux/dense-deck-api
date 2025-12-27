import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import { randomUUID, createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "dd_session";
const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

export type AuthUser = {
  userId: string;
  isGuest: boolean;
  username: string;
  usernameChanged?: boolean;
  email?: string | null;
};

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function makeUsername() {
  return `Player-${randomBytes(3).toString("hex")}`;
}

export async function createSession(userId: string, isGuest: boolean) {
  const expires = new Date(Date.now() + SESSION_LIFETIME_MS);
  const session = await prisma.sessions.create({
    data: {
      user_id: userId,
      is_guest: isGuest,
      expires_at: expires,
    },
  });
  return session;
}

export async function destroySession(sessionId: string) {
  await prisma.sessions.deleteMany({ where: { session_id: sessionId } });
}

export async function loadUserFromSession(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthUser | null> {
  const sessionId = (request.cookies as any)?.[SESSION_COOKIE];
  if (!sessionId) return null;

  const session = await prisma.sessions.findUnique({
    where: { session_id: sessionId },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expires_at.getTime() < Date.now()) {
    await destroySession(session.session_id);
    reply.clearCookie(SESSION_COOKIE);
    return null;
  }
  // sliding expiration
  const newExpiry = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.sessions.update({
    where: { session_id: session.session_id },
    data: { expires_at: newExpiry },
  });
  reply.setCookie(SESSION_COOKIE, session.session_id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires: newExpiry,
  });
  return {
    userId: session.user_id,
    isGuest: session.is_guest,
    username: session.user.username,
    usernameChanged: session.user.username_changed,
    email: session.user.email,
  };
}

export function attachSessionCookie(reply: FastifyReply, sessionId: string, expires: Date) {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}
