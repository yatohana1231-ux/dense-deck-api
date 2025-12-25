import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDealRoutes } from "./routes/deal.js";
import { registerHistoryRoutes } from "./routes/history.js";
import { registerAuthRoutes } from "./routes/auth.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? "3000");

const app = Fastify({ logger: true });

await app.register(cookie, {
  secret: process.env.COOKIE_SECRET ?? "changeme",
});

await registerHealthRoutes(app);
await registerDealRoutes(app);
await registerHistoryRoutes(app);
await registerAuthRoutes(app);

app.listen({ host: HOST, port: PORT });

