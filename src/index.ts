import Fastify from "fastify";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDealRoutes } from "./routes/deal.js";
import { registerHistoryRoutes } from "./routes/history.js";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? "3000");

const app = Fastify({ logger: true });

await registerHealthRoutes(app);
await registerDealRoutes(app);
await registerHistoryRoutes(app);

app.listen({ host: HOST, port: PORT });

