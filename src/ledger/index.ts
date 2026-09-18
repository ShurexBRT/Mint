import type { DB } from '../database/index.js';
import { ledger } from '../database/schema.js';
import { id, now } from '../shared/identity.js';
export function record(db: Pick<DB, 'insert'>, entry: { agent: string; action: string; opportunityId?: string; experimentId?: string; evidenceIds?: string[]; decision?: string; result: unknown }) {
  db.insert(ledger).values({ ...entry, id: id(), createdAt: now(), costEstimate: 0, evidenceIds: entry.evidenceIds ?? [] }).run();
}
