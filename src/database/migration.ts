// Versioned, transactional local migrations. Drizzle owns application reads/writes.
export const migrationV1 = `
CREATE TABLE opportunities (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, problem_statement TEXT NOT NULL, target_user TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','RESEARCH_MORE','VALIDATE','BUILD','KILL')),
 synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic = 1),
 demand_score REAL NOT NULL DEFAULT 0, urgency_score REAL NOT NULL DEFAULT 0, willingness_to_pay_score REAL NOT NULL DEFAULT 0,
 competition_score REAL NOT NULL DEFAULT 0, build_complexity_score REAL NOT NULL DEFAULT 0, distribution_score REAL NOT NULL DEFAULT 0,
 recurring_score REAL NOT NULL DEFAULT 0, total_score REAL NOT NULL DEFAULT 0, palermo_verdict TEXT NOT NULL DEFAULT 'PENDING',
 scores TEXT, analysis TEXT, palermo TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE evidence (
 id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id), source_url TEXT NOT NULL, source_type TEXT NOT NULL,
 excerpt TEXT NOT NULL, signal_type TEXT NOT NULL, source_identity TEXT NOT NULL, community TEXT NOT NULL,
 captured_at TEXT NOT NULL, confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1), synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic = 1)
);
CREATE INDEX evidence_opportunity_idx ON evidence(opportunity_id);
CREATE TABLE agent_runs (
 id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id), agent TEXT NOT NULL, provider TEXT NOT NULL,
 input TEXT NOT NULL, output TEXT, duration INTEGER NOT NULL, estimated_tokens INTEGER NOT NULL DEFAULT 0,
 estimated_cost REAL NOT NULL DEFAULT 0 CHECK(estimated_cost = 0), status TEXT NOT NULL, error TEXT, created_at TEXT NOT NULL
);
CREATE TABLE decisions (id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id), decision TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE experiments (
 id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id), hypothesis TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','KILLED')), synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic = 1), created_at TEXT NOT NULL, ended_at TEXT
);
CREATE UNIQUE INDEX one_active_experiment ON experiments(opportunity_id) WHERE status = 'ACTIVE';
CREATE TABLE metrics (
 id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(id), event_id TEXT NOT NULL UNIQUE,
 visits INTEGER NOT NULL, signups INTEGER NOT NULL, purchases INTEGER NOT NULL, revenue REAL NOT NULL,
 verified INTEGER NOT NULL DEFAULT 0, synthetic INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
 CHECK(synthetic = 1 AND verified = 0), CHECK(visits >= signups AND signups >= purchases AND purchases >= 0 AND revenue >= 0), CHECK(revenue = 0 OR purchases > 0)
);
CREATE TABLE cost_entries (
 id TEXT PRIMARY KEY, agent_run_id TEXT REFERENCES agent_runs(id), cost REAL NOT NULL DEFAULT 0 CHECK(cost = 0), category TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE ledger (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, agent TEXT NOT NULL,
 opportunity_id TEXT REFERENCES opportunities(id), experiment_id TEXT REFERENCES experiments(id), action TEXT NOT NULL,
 cost_estimate REAL NOT NULL DEFAULT 0 CHECK(cost_estimate = 0), evidence_ids TEXT NOT NULL, decision TEXT, result TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TABLE builder_jobs (id TEXT PRIMARY KEY, opportunity_id TEXT NOT NULL REFERENCES opportunities(id), status TEXT NOT NULL DEFAULT 'DISABLED' CHECK(status = 'DISABLED'), specification TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE distribution_experiments (id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(id), channel TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'REQUIRES_OWNER_APPROVAL' CHECK(status = 'REQUIRES_OWNER_APPROVAL'), created_at TEXT NOT NULL);
`;

export const migrationV2 = `
ALTER TABLE evidence ADD COLUMN complexity_estimate INTEGER CHECK(complexity_estimate BETWEEN 1 AND 5);
CREATE TRIGGER synthetic_no_build BEFORE UPDATE OF status ON opportunities WHEN NEW.status = 'BUILD' AND NEW.synthetic = 1 BEGIN SELECT RAISE(ABORT, 'synthetic evidence cannot authorize BUILD'); END;
CREATE TRIGGER synthetic_no_build_insert BEFORE INSERT ON opportunities WHEN NEW.status = 'BUILD' AND NEW.synthetic = 1 BEGIN SELECT RAISE(ABORT, 'synthetic evidence cannot authorize BUILD'); END;
`;

export const migrationV3 = `
ALTER TABLE opportunities ADD COLUMN evidence_mode TEXT NOT NULL DEFAULT 'SYNTHETIC' CHECK(evidence_mode IN ('SYNTHETIC','LIVE','MIXED'));

DROP INDEX IF EXISTS evidence_opportunity_idx;
ALTER TABLE evidence RENAME TO evidence_v2_backup;
CREATE TABLE evidence (
 id TEXT PRIMARY KEY,
 opportunity_id TEXT NOT NULL REFERENCES opportunities(id),
 source_url TEXT NOT NULL,
 source_type TEXT NOT NULL,
 excerpt TEXT NOT NULL,
 signal_type TEXT NOT NULL,
 source_identity TEXT NOT NULL,
 community TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 synthetic INTEGER NOT NULL DEFAULT 1 CHECK(synthetic IN (0,1)),
 complexity_estimate INTEGER CHECK(complexity_estimate BETWEEN 1 AND 5)
);
INSERT INTO evidence (
 id, opportunity_id, source_url, source_type, excerpt, signal_type, source_identity, community,
 captured_at, confidence, synthetic, complexity_estimate
)
SELECT
 id, opportunity_id, source_url, source_type, excerpt, signal_type, source_identity, community,
 captured_at, confidence, synthetic, complexity_estimate
FROM evidence_v2_backup;
DROP TABLE evidence_v2_backup;
CREATE INDEX evidence_opportunity_idx ON evidence(opportunity_id);

CREATE TABLE research_signals (
 id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL UNIQUE,
 source TEXT NOT NULL CHECK(source IN ('github','hackernews')),
 source_url TEXT NOT NULL,
 source_type TEXT NOT NULL CHECK(source_type IN ('issue','forum')),
 title TEXT NOT NULL,
 excerpt TEXT NOT NULL,
 signal_type TEXT NOT NULL,
 source_identity TEXT NOT NULL,
 community TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 1),
 query TEXT NOT NULL,
 collected_at TEXT NOT NULL
);
CREATE INDEX research_signals_collected_idx ON research_signals(collected_at);
CREATE INDEX research_signals_type_idx ON research_signals(signal_type);

CREATE TABLE research_clusters (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 problem_statement TEXT NOT NULL,
 target_user TEXT NOT NULL,
 signal_ids TEXT NOT NULL,
 keywords TEXT NOT NULL,
 source_count INTEGER NOT NULL,
 domain_count INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','PROMOTED','REJECTED')),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);

CREATE TABLE radar_runs (
 id TEXT PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('SUCCESS','PARTIAL','FAILED')),
 queries TEXT NOT NULL,
 request_count INTEGER NOT NULL,
 signal_count INTEGER NOT NULL,
 cluster_count INTEGER NOT NULL,
 errors TEXT NOT NULL,
 created_at TEXT NOT NULL
);
`;
