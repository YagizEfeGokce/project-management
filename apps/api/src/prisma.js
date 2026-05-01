let PrismaClient = null;
try {
  const prismaMod = await import('@prisma/client');
  PrismaClient = prismaMod.PrismaClient;
} catch {
  PrismaClient = null;
}

let prisma;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!hasDatabaseUrl()) return null;
  if (!PrismaClient) {
    throw new Error('DATABASE_URL is set but @prisma/client is not available. Run "npm install" or generate the client.');
  }
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}
