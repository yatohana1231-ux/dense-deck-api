import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../utils/prisma.js";
import { assert } from "../utils/assert.js";
import {
  attachSessionCookie,
  clearSessionCookie,
  createSession,
  hashPassword,
  loadUserFromSession,
  verifyPassword,
  makeUsername,
} from "../utils/auth.js";
import crypto from "crypto";

async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = await loadUserFromSession(request, reply);
  if (!user) {
    reply.code(401).send({ message: "Unauthorized" });
    return null;
  }
  (request as any).authUser = user;
  return user;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/guest", async (req, reply) => {
    const sessionUser = await loadUserFromSession(req, reply);
    if (sessionUser) {
      return reply.send(sessionUser);
    }
    const username = makeUsername();
    const user = await prisma.users.create({
      data: { username },
    });
    const session = await createSession(user.user_id, true);
    attachSessionCookie(reply, session.session_id, session.expires_at);
    return reply.send({
      userId: user.user_id,
      isGuest: true,
      username: user.username,
      usernameChanged: user.username_changed,
      email: user.email,
    });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = await loadUserFromSession(req, reply);
    if (!user) {
      return reply.code(401).send({ message: "Unauthorized" });
    }
    return reply.send(user);
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const sessionId = (req as any).cookies?.dd_session;
    if (sessionId) {
      await prisma.sessions.deleteMany({ where: { session_id: sessionId } });
    }
    clearSessionCookie(reply);
    reply.send({ ok: true });
  });

  app.post("/api/auth/register", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string; username?: string; later?: boolean };
    assert(typeof body.email === "string" && body.email.length > 3, "email required");
    assert(typeof body.password === "string" && body.password.length >= 6, "password too short");

    const wantsUsername = !!body.username && !body.later;
    if (wantsUsername) {
      if (!/^[A-Za-z0-9_.-]{1,20}$/.test(body.username ?? "")) {
        return reply.code(400).send({ message: "Invalid username" });
      }
      const exists = await prisma.users.findUnique({ where: { username: body.username as string } });
      if (exists) {
        return reply.code(409).send({ message: "Username taken" });
      }
    }

    const existing = await prisma.users.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ message: "Email already registered" });
    }

    const sessionUser = await loadUserFromSession(req, reply);
    const password_hash = await hashPassword(body.password);
    let userId: string;
    if (sessionUser) {
      // promote guest to registered
      userId = sessionUser.userId;
      const data: any = { email: body.email, password_hash };
      if (wantsUsername) {
        data.username = body.username;
        data.username_changed = true;
      }
      await prisma.users.update({
        where: { user_id: userId },
        data,
      });
      // expire old session and create new registered session
      if ((req as any).cookies?.dd_session) {
        await prisma.sessions.deleteMany({ where: { session_id: (req as any).cookies.dd_session } });
      }
    } else {
      const username = wantsUsername ? (body.username as string) : makeUsername();
      const user = await prisma.users.create({
        data: {
          email: body.email,
          password_hash,
          username,
          username_changed: wantsUsername,
        },
      });
      userId = user.user_id;
    }

    const session = await createSession(userId, false);
    attachSessionCookie(reply, session.session_id, session.expires_at);
    reply.send({ ok: true, userId });
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; password?: string };
    assert(typeof body.email === "string", "email required");
    assert(typeof body.password === "string", "password required");

    const user = await prisma.users.findUnique({ where: { email: body.email } });
    if (!user || !user.password_hash) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ message: "Invalid credentials" });
    }
    // clear old session if any
    if ((req as any).cookies?.dd_session) {
      await prisma.sessions.deleteMany({ where: { session_id: (req as any).cookies.dd_session } });
    }
    const session = await createSession(user.user_id, false);
    attachSessionCookie(reply, session.session_id, session.expires_at);
    reply.send({
      userId: user.user_id,
      isGuest: false,
      username: user.username,
      usernameChanged: user.username_changed,
      email: user.email,
    });
  });

  app.post("/api/user/username", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const body = (req.body ?? {}) as { username?: string };
    assert(typeof body.username === "string", "username required");
    const u = await prisma.users.findUnique({ where: { user_id: user.userId } });
    if (!u) return reply.code(404).send({ message: "not found" });
    if (u.username_changed) {
      return reply.code(400).send({ message: "username already changed" });
    }
    // simple validation
    if (!/^[A-Za-z0-9_.-]{1,20}$/.test(body.username)) {
      return reply.code(400).send({ message: "invalid username" });
    }
    // uniqueness
    const existing = await prisma.users.findUnique({ where: { username: body.username } });
    if (existing) return reply.code(409).send({ message: "username taken" });

    await prisma.users.update({
      where: { user_id: user.userId },
      data: { username: body.username, username_changed: true },
    });
    reply.send({ ok: true, username: body.username });
  });

  // Password reset request (response is generic)
  app.post("/api/password/reset/request", async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string };
    const email = body.email;
    if (typeof email === "string") {
      const user = await prisma.users.findUnique({ where: { email } });
      if (user) {
        const token = crypto.randomUUID();
        const expires = new Date(Date.now() + 1000 * 60 * 60); // 1h
        await prisma.password_reset_tokens.create({
          data: {
            token,
            user_id: user.user_id,
            expires_at: expires,
          },
        });
        // TODO: send email; for MVP we just log
        req.log.info({ token }, "password reset token (MVP log only)");
      }
    }
    return reply.send({ ok: true });
  });

  app.post("/api/password/reset/confirm", async (req, reply) => {
    const body = (req.body ?? {}) as { token?: string; password?: string };
    assert(typeof body.token === "string", "token required");
    assert(typeof body.password === "string" && body.password.length >= 6, "password too short");
    const pr = await prisma.password_reset_tokens.findUnique({ where: { token: body.token } });
    if (!pr || pr.used || pr.expires_at.getTime() < Date.now()) {
      return reply.code(400).send({ message: "invalid token" });
    }
    const hash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.users.update({
        where: { user_id: pr.user_id },
        data: { password_hash: hash },
      }),
      prisma.password_reset_tokens.update({
        where: { token: body.token },
        data: { used: true },
      }),
    ]);
    reply.send({ ok: true });
  });
}
