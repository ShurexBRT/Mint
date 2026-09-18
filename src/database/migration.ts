// Versioned, transactional local migration. Drizzle owns application reads/writes.
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
