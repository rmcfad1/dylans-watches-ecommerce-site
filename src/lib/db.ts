import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./dev.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

  let resolvedUrl = url;
  // Convert relative file: paths to absolute for local dev
  if (url.startsWith("file:") && !url.startsWith("file:/")) {
    const filePath = url.replace(/^file:/, "");
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    resolvedUrl = `file:${abs}`;
  }

  const adapter = new PrismaLibSql({
    url: resolvedUrl,
    ...(authToken ? { authToken } : {}),
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
