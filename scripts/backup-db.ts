import { loadEnvConfig } from '@next/env';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
loadEnvConfig(process.cwd());
async function main() {
  const db = (await import('../src/lib/db')).default;
  mkdirSync('backups', { recursive: true, mode: 0o700 });
  const file = path.resolve('backups', `scientarium-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await db.backup(file);
  db.close();
  console.log(`Backup saved: ${file}`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
