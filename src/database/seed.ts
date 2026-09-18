import { readConfig } from '../config/index.js';
import { openDatabase } from './index.js';
import { seedDemo } from './demo.js';
import { MintService } from '../engine/service.js';
const config = readConfig();
const { db, sqlite } = openDatabase(config.databasePath);
try { const ids = await seedDemo(new MintService(db, config.rules)); console.log(`Synthetic demo ready: ${ids.length} opportunities. No real market evidence or revenue.`); } finally { sqlite.close(); }
