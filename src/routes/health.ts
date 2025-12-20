import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get("/api/health", async () => {
    return { ok: true, service: "dense-deck-api" };
  });

  // 互換用（過去の確認に使ってた場合）
  app.get("/health", async () => {
    return { ok: true, service: "dense-deck-api" };
  });
}

