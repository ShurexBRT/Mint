import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';
import { migrationV1, migrationV2 } from './migration.js';
export function openDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  const version = sqlite.pragma('user_version', { simple: true }) as number;
  if (version > 2) throw new Error('Database version is newer than this application.');
  if (version === 0) sqlite.transaction(() => { sqlite.exec(migrationV1); sqlite.pragma('user_version = 1'); })();
  if (version < 2) sqlite.transaction(() => { sqlite.exec(migrationV2); sqlite.pragma('user_version = 2'); })();
  return { db: drizzle(sqlite, { schema }), sqlite };
}
export type DB = ReturnType<typeof openDatabase>['db'];
