import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { initialDbGzipBase64 } from './db-seed-data';

function setupPrismaConnection(): { url: string } {
  // If an external database URL is configured (e.g. Postgres / Supabase / Neon)
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return { url: process.env.DATABASE_URL };
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    const tmpDir = process.platform === 'win32' ? os.tmpdir() : '/tmp';
    const tmpDbPath = path.join(tmpDir, 'school_bite_dev.db');

    let needsInit = true;
    try {
      if (fs.existsSync(tmpDbPath) && fs.statSync(tmpDbPath).size > 0) {
        needsInit = false;
      }
    } catch {
      needsInit = true;
    }

    if (needsInit) {
      try {
        const buffer = zlib.gunzipSync(Buffer.from(initialDbGzipBase64, 'base64'));
        fs.writeFileSync(tmpDbPath, buffer);
        console.log(`[Prisma] Unpacked compressed seed database to ${tmpDbPath} (${buffer.length} bytes)`);
      } catch (err) {
        console.error('[Prisma] Failed to unpack seed database:', err);
      }

      try {
        fs.chmodSync(tmpDbPath, 0o666);
      } catch {
        // Ignore on platforms without chmod support
      }
    }

    const formattedUrl = `file:${tmpDbPath.replace(/\\/g, '/')}`;
    process.env.DATABASE_URL = formattedUrl;
    return { url: formattedUrl };
  }

  // Local / Docker environment
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL };
  }

  const localDb = path.resolve(process.cwd(), 'prisma', 'dev.db');
  const formattedUrl = `file:${localDb.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = formattedUrl;
  return { url: formattedUrl };
}

const { url: activeDbUrl } = setupPrismaConnection();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: activeDbUrl,
      },
    },
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
export default prisma;
