import { PrismaClient } from '@prisma/client';

let prisma;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!hasDatabaseUrl()) return null;
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}
