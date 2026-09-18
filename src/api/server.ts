import { existsSync } from 'node:fs';
import { readConfig } from '../config/index.js';
import { openDatabase } from '../database/index.js';
import { MintService } from '../engine/service.js';
import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const config = readConfig();
const { db, sqlite } = openDatabase(config.databasePath);
const service = new MintService(db, config.rules, undefined, config.radar);

const server = createApp(service).listen(config.port, '127.0.0.1', () =>
  console.log(
    `MINT local lab: http://127.0.0.1:${config.port} | SPEND_LIMIT=0 | live public research enabled | no paid/external execution`,
  ),
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => {
    sqlite.close();
    process.exit(0);
  }));
}
