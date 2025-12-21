import { PrismaClient } from "@prisma/client";

// Singleton Prisma client to reuse connections across routes.
export const prisma = new PrismaClient();
