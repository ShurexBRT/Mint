import { readConfig } from '../config/index.js';
import { openDatabase } from './index.js';
const config = readConfig();
const { sqlite } = openDatabase(config.databasePath);
sqlite.close();
console.log(`Local SQLite initialized: ${config.databasePath}`);
