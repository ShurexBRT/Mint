import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../database/index.js';
import * as tables from '../database/schema.js';
import { ExperimentInputSchema, MetricInputSchema, OpportunityInputSchema } from '../models/index.js';
import type { Rules } from '../config/index.js';
import { id, now } from '../shared/identity.js';
import { record } from '../ledger/index.js';
import { Pipeline } from './pipeline.js';
import { authorize } from './authority.js';
import { aggregateMetrics } from '../experiments/analytics.js';
import { evaluateKill } from '../experiments/kill.js';
import { inspectEvidence } from '../evidence/validate.js';

export class MintService {
  readonly pipeline: Pipeline;
  constructor(readonly db: DB, readonly rules: Rules) { this.pipeline = new Pipeline(db, rules); }
  createOpportunity(raw: unknown) {
    const input = OpportunityInputSchema.parse(raw), opportunityId = id();
    this.db.transaction(tx => {
      tx.insert(tables.opportunities).values({ id: opportunityId, title: input.title, problemStatement: input.problemStatement, targetUser: input.targetUser, synthetic: true, createdAt: now(), updatedAt: now() }).run();
      for (const item of input.evidence) tx.insert(tables.evidence).values({ ...item, id: id(), opportunityId }).run();
      record(tx, { agent: 'Scout', action: 'SYNTHETIC_EVIDENCE_IMPORTED', opportunityId, result: { count: input.evidence.length, synthetic: true } });
    });
    return this.detail(opportunityId);
  }
  listOpportunities() {
    const evidence = this.db.select().from(tables.evidence).all();
    return this.db.select().from(tables.opportunities).orderBy(desc(tables.opportunities.createdAt)).all().map(o => ({ ...o, evidenceCount: evidence.filter(e => e.opportunityId === o.id).length, independentCount: inspectEvidence(evidence.filter(e => e.opportunityId === o.id), this.rules).accepted.length }));
  }
  detail(opportunityId: string) {
    const opportunity = this.db.select().from(tables.opportunities).where(eq(tables.opportunities.id, opportunityId)).get();
    if (!opportunity) throw new Error('Opportunity not found.');
    const evidence = this.db.select().from(tables.evidence).where(eq(tables.evidence.opportunityId, opportunityId)).all();
    return { ...opportunity, evidence, evidenceReview: inspectEvidence(evidence, this.rules),
      decisions: this.db.select().from(tables.decisions).where(eq(tables.decisions.opportunityId, opportunityId)).orderBy(desc(tables.decisions.createdAt)).all(),
      runs: this.db.select().from(tables.agentRuns).where(eq(tables.agentRuns.opportunityId, opportunityId)).orderBy(desc(tables.agentRuns.createdAt)).all() };
  }
  listLedger() { return this.db.select().from(tables.ledger).orderBy(desc(tables.ledger.sequence)).all(); }
  listExperiments() {
    const metrics = this.db.select().from(tables.metrics).all();
    return this.db.select().from(tables.experiments).orderBy(desc(tables.experiments.createdAt)).all().map(e => {
      const totals = aggregateMetrics(metrics.filter(m => m.experimentId === e.id));
      const kill = evaluateKill({ ...totals, revenue: totals.demoRevenue, createdAt: e.createdAt }, this.rules);
      return { ...e, ...totals, kill };
    });
  }
  overview() {
    const opportunities = this.listOpportunities(), experiments = this.listExperiments();
    const costs = this.db.select().from(tables.costEntries).all();
    const revenue = aggregateMetrics(this.db.select().from(tables.metrics).all()).verifiedRevenue;
    const externalSpend = costs.filter(c => c.category === 'EXTERNAL').reduce((n, c) => n + c.cost, 0);
    const aiSpend = costs.filter(c => c.category === 'AI_API').reduce((n, c) => n + c.cost, 0);
    return { discovered: opportunities.length, researching: opportunities.filter(o => o.status === 'RESEARCH_MORE' || o.status === 'NEW').length,
      validationCandidates: opportunities.filter(o => o.status === 'VALIDATE').length, activeExperiments: experiments.filter(e => e.status === 'ACTIVE').length,
      killedExperiments: experiments.filter(e => e.status === 'KILLED').length, externalSpend, aiSpend, revenue, net: revenue - externalSpend - aiSpend,
      spendLimit: 0, provider: 'deterministic-local', syntheticOnly: true };
  }
  createExperiment(raw: unknown) {
    const input = ExperimentInputSchema.parse(raw);
    const opportunity = this.detail(input.opportunityId);
    if (opportunity.status !== 'VALIDATE') throw new Error('Only VALIDATE opportunities can create an internal experiment.');
    if (this.listExperiments().some(e => e.opportunityId === input.opportunityId && e.status === 'ACTIVE')) throw new Error('An active experiment already exists.');
    const experimentId = id();
    this.db.transaction(tx => {
      tx.insert(tables.experiments).values({ ...input, id: experimentId, synthetic: true, createdAt: now() }).run();
      record(tx, { agent: 'Director', action: 'EXPERIMENT_CREATED', opportunityId: input.opportunityId, experimentId, result: { hypothesis: input.hypothesis, synthetic: true } });
    });
    return this.listExperiments().find(e => e.id === experimentId)!;
  }
  addMetric(raw: unknown) {
    const input = MetricInputSchema.parse(raw);
    const experiment = this.listExperiments().find(e => e.id === input.experimentId);
    if (!experiment || experiment.status !== 'ACTIVE') throw new Error('Active experiment not found.');
    if (this.db.select().from(tables.metrics).where(eq(tables.metrics.eventId, input.eventId)).get()) throw new Error('Duplicate metric event; already recorded.');
    this.db.transaction(tx => {
      tx.insert(tables.metrics).values({ ...input, id: id(), verified: false, createdAt: now() }).run();
      record(tx, { agent: 'Analytics', action: 'SYNTHETIC_METRIC_RECORDED', experimentId: experiment.id, opportunityId: experiment.opportunityId, result: input });
    });
    return this.listExperiments().find(e => e.id === experiment.id)!;
  }
  evaluateExperiment(experimentId: string, apply = false) {
    const experiment = this.listExperiments().find(e => e.id === experimentId);
    if (!experiment || experiment.status !== 'ACTIVE') throw new Error('Active experiment not found.');
    this.db.transaction(tx => {
      if (apply && experiment.kill.recommendation === 'KILL') tx.update(tables.experiments).set({ status: 'KILLED', endedAt: now() }).where(eq(tables.experiments.id, experimentId)).run();
      record(tx, { agent: 'Kill Engine', action: apply && experiment.kill.recommendation === 'KILL' ? 'EXPERIMENT_KILLED' : 'KILL_EVALUATED', experimentId, opportunityId: experiment.opportunityId, decision: experiment.kill.recommendation, result: experiment.kill });
    });
    return experiment.kill;
  }
  requestAction(raw: unknown) {
    const input = z.object({ action: z.string().min(1), mayCostMoney: z.boolean().default(false) }).strict().parse(raw);
    const result = authorize(input.action, input.mayCostMoney);
    record(this.db, { agent: 'Authority', action: 'AUTHORITY_CHECK', decision: result.status, result: { ...input, ...result } });
    return result;
  }
  createDistribution(raw: unknown) {
    const input = z.object({ experimentId: z.string(), channel: z.string().trim().min(3).max(300), message: z.string().trim().min(12).max(3000) }).strict().parse(raw);
    const experiment = this.listExperiments().find(e => e.id === input.experimentId && e.status === 'ACTIVE');
    if (!experiment) throw new Error('Active experiment not found.');
    const entry = { ...input, id: id(), status: 'REQUIRES_OWNER_APPROVAL', createdAt: now() };
    this.db.transaction(tx => {
      tx.insert(tables.distributionExperiments).values(entry).run();
      record(tx, { agent: 'Distribution', action: 'DISTRIBUTION_DRAFTED', experimentId: experiment.id, opportunityId: experiment.opportunityId, decision: entry.status, result: { ...entry, executed: false } });
    });
    return entry;
  }
  createBuilderJob(raw: unknown) {
    const input = z.object({ opportunityId: z.string(), specification: z.string().trim().min(12).max(5000) }).strict().parse(raw);
    this.detail(input.opportunityId);
    const job = { ...input, id: id(), status: 'DISABLED', createdAt: now() };
    this.db.transaction(tx => { tx.insert(tables.builderJobs).values(job).run(); record(tx, { agent: 'Builder', action: 'DISABLED_JOB_RECORDED', opportunityId: input.opportunityId, result: job }); });
    return job;
  }
}
