const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Ensure DATABASE_URL is set so prisma generate doesn't fail during Vercel build
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/postgres";
}

try {
  const prismaCliPath = path.resolve(__dirname, '../../node_modules/prisma/build/index.js');
  if (fs.existsSync(prismaCliPath)) {
    console.log('[Postinstall] Running Prisma Generate...');
    execSync(`node "${prismaCliPath}" generate`, { stdio: 'inherit' });
  } else {
    console.warn('[Postinstall] Prisma CLI not found, skipping generate.');
  }
} catch (error) {
  console.error('[Postinstall] Prisma generate failed:', error.message);
  process.exit(1);
}
