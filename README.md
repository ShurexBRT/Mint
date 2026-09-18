# MINT — Autonomous Micro-Business Engine

MINT is a **zero-cost-first, local-first research and validation engine** for finding repeated public pain signals, challenging them, and deciding whether a micro-business opportunity deserves validation.

MINT is not a trading bot, a gambling system, a spam engine, or a promise of revenue.

## Mission

The long-term loop is:

```text
public pain signals
      ↓
Research Radar
      ↓
evidence verification
      ↓
problem clustering
      ↓
Scout → Analyst → Scorer → Palermo → Director
      ↓
RESEARCH_MORE / VALIDATE / KILL
      ↓
small validation experiment
      ↓
measure / kill / continue
```

The first economic milestone remains:

> **€1 of verified external revenue**

Phase 2 is intentionally earlier than that milestone. It is about proving that MINT can find a real problem without us inventing the idea first.

## Hard financial rule

**SPEND_LIMIT = €0**

MINT has no paid API adapter, no paid search service, no ad account integration, no trading path, and no automatic purchasing path.

At multiple layers:

- config rejects a non-zero spend limit,
- authority rules deny paid execution,
- cost rows are constrained to zero,
- paid external actions have no executor,
- the dashboard always separates demo revenue from verified external revenue.

## Phase 2.1: Autonomous Opportunity Hunter

MINT can now run a deterministic **Autonomous Hunt** without asking the owner to invent search terms.

The hunter rotates through zero-cost research missions such as:

- operations data friction,
- commerce administration,
- developer toil,
- integration gaps,
- support operations,
- document workflows.

Each mission supplies four bounded research queries to Radar. After collection, MINT grades candidate clusters on signal count, identity diversity, source diversity, domain/community diversity, explicit pain, buying intent, recurrence, and confidence.

A cluster may be **automatically promoted only into the internal decision pipeline** when it clears strict quality gates. Auto-promotion does not mean BUILD and cannot trigger any public or paid action.

The hunter may promote at most one candidate per mission. Posting, messaging, deployment, account creation, purchasing, and spending remain unavailable.

## Phase 2: Research Radar

MINT can now perform limited live research against two allowlisted public, keyless endpoints:

- GitHub Issues search via `api.github.com`
- Hacker News search via `hn.algolia.com`

Radar does **not** crawl arbitrary websites.

It does not:

- bypass authentication,
- bypass robots controls,
- use paid search,
- use proxies,
- post comments,
- send messages,
- create accounts,
- purchase traffic,
- deploy products.

### Radar limits

Default limits:

- at most 4 queries per run,
- at most 5 results per source/query,
- 10-minute cooldown between runs,
- 10-second request timeout,
- 2 MB response-size safety limit,
- allowlisted hosts only.

Configure lower limits if desired:

```env
MINT_RADAR_JSON={"cooldownMinutes":10,"maxQueries":4,"perSourceLimit":5}
```

## Signal collection

Live collectors only keep text that matches explicit deterministic signals such as:

- manual / tedious / repetitive work,
- recurring work,
- urgency,
- explicit willingness to pay,
- current workarounds.

A public post is **not** treated as proof of demand.

Each stored signal keeps:

- source URL,
- public source identity,
- community/repository,
- original timestamp,
- query that found it,
- signal type,
- confidence,
- stable fingerprint.

Signals are deduplicated using stable source fingerprints.

## Clustering

MINT performs deterministic token clustering.

A candidate cluster requires at least:

- 3 distinct public identities,
- repeated meaningful keywords.

Weak or unrelated signals remain unpromoted.

When a cluster is promoted, it becomes an opportunity with **LIVE evidence** and passes through the normal decision pipeline.

## Core decision pipeline

### Scout

Validates supplied evidence, removes duplicates, rejects private/non-public hosts, low-confidence items, future timestamps, and repeated source identities.

### Analyst

Groups signal types and surfaces alternatives and implementation-complexity evidence.

### Scorer

Produces evidence-linked scores for:

- demand,
- urgency,
- willingness to pay,
- competition pressure,
- build complexity,
- distribution,
- recurring need.

### Palermo

Adversarial reviewer.

Critical legal, privacy, security, or platform-policy risk produces a **VETO**.

Commodity pressure no longer automatically kills an idea. It produces **CAUTION** because competition can be evidence that a market exists; differentiation still has to be proven.

### Director

Current outcomes:

- `RESEARCH_MORE`
- `VALIDATE`
- `KILL`

A future `BUILD` path exists in the domain model, but Phase 2 still does not execute builds.

Commercial validation now requires explicit willingness-to-pay evidence in addition to pain, independent evidence, multiple communities, and score thresholds. Explicit distribution evidence remains a hard BUILD gate.

## Evidence modes

Opportunities expose:

- `SYNTHETIC` — demo fixtures only,
- `LIVE` — promoted public Radar evidence,
- `MIXED` — reserved for a later workflow.

The legacy `synthetic` opportunity column remains a database safety latch in Phase 2, so automatic BUILD remains blocked even when live evidence is present.

That is deliberate.

## Experiments

Phase 2 experiments are still **internal/synthetic validation records**.

They can record demo metrics and exercise kill rules, but they do not yet represent verified real-world revenue.

The current database still prevents synthetic metrics from becoming verified revenue.

A future Phase 3 will introduce explicit real-validation and verified-revenue provenance rather than weakening this safety rule.

## Kill Engine

Default stopping rules:

- after 14 days and at least 100 visits, fewer than 3 signups → KILL,
- after 30 days with no purchases → KILL.

Thresholds are configurable, but minimum research safeguards cannot be weakened below the hard floor.

## Authority model

### Autonomous

- local analysis,
- evidence checks,
- scoring,
- Research Radar reads against allowlisted public endpoints,
- internal experiment records,
- analytics.

### Owner approval required, with no automatic executor in Phase 2

- sending messages,
- public posting,
- account creation,
- deployment,
- pricing changes,
- anything that could cost money.

### Prohibited

- financial trading,
- crypto trading,
- gambling,
- deception,
- fake reviews,
- spam,
- purchased engagement,
- unauthorized access,
- hiding AI identity when disclosure is required.

## Stack

- Node.js
- TypeScript
- Express
- SQLite
- Drizzle ORM
- Zod
- React
- Vite
- Vitest
- Playwright dependency reserved for UI testing

No OpenAI key is required.

The LLM provider interface remains in place, but Phase 2 uses deterministic local logic only.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
npm run db:init
npm run dev
```

Dashboard:

```text
http://127.0.0.1:5173
```

API:

```text
http://127.0.0.1:4310
```

## Commands

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run format:check
```

## Database

Default local database:

```text
./data/mint.sqlite
```

Current schema version: **3** (Phase 2.1 adds no new persistence migration; cluster quality is derived from stored live signals.)

Key tables include:

- opportunities
- evidence
- agent_runs
- decisions
- experiments
- metrics
- cost_entries
- ledger
- builder_jobs
- distribution_experiments
- research_signals
- research_clusters
- radar_runs

The ledger is append-only through SQLite triggers.

## Synthetic demo

The existing demo remains useful for verifying orchestration:

- one opportunity → `VALIDATE`
- one → `RESEARCH_MORE`
- one high-risk idea → Palermo `VETO` → `KILL`

Synthetic evidence can never authorize BUILD.

## Phase 2 acceptance target

Phase 2 is useful when MINT can:

1. run live Radar for €0,
2. collect public pain signals,
3. deduplicate them,
4. cluster repeated problems,
5. promote a cluster into LIVE evidence,
6. pass it through Scout → Analyst → Scorer → Palermo → Director,
7. honestly return `RESEARCH_MORE` when commercial evidence is still missing.

The system should prefer an empty queue over fabricated demand.

## Next: Phase 3

Phase 3 should focus on **validation outside the lab**, still with explicit owner gates:

- real validation provenance,
- permission-based distribution,
- zero-cost landing-page/build workflow,
- verified external metrics,
- verified revenue accounting,
- first €1 milestone.

No step should weaken the €0 autonomous-spend rule.
