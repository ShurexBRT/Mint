import { existsSync } from 'node:fs';
import { readConfig } from '../config/index.js';
import { openDatabase } from '../database/index.js';
import { MintService } from '../engine/service.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const config = readConfig();
const { db, sqlite } = openDatabase(config.databasePath);
const service = new MintService(db, config.rules, undefined, config.radar);
const autoPromote = !process.argv.includes('--no-promote');

try {
  const result = await service.runHunter({ autoPromote });
  console.log(JSON.stringify({
    mission: result.mission,
    signals: result.signalCount,
    clusters: result.clusterCount,
    eligibleClusters: result.eligibleClusterCount,
    promotedOpportunityIds: result.promotedOpportunityIds,
    errors: result.errors,
    externalActions: result.externalActions,
    spend: result.spend,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  sqlite.close();
}
