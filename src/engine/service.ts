import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../database/index.js';
import * as tables from '../database/schema.js';
import {
  ExperimentInputSchema,
  MetricInputSchema,
  OpportunityInputSchema,
  SignalSchema,
} from '../models/index.js';
import { RadarConfigSchema, type Rules } from '../config/index.js';
import { id, now } from '../shared/identity.js';
import { record } from '../ledger/index.js';
import { Pipeline } from './pipeline.js';
import { authorize } from './authority.js';
import { aggregateMetrics } from '../experiments/analytics.js';
import { evaluateKill } from '../experiments/kill.js';
import { inspectEvidence } from '../evidence/validate.js';
import { DEFAULT_QUERIES, ResearchRadar } from '../research/radar.js';
import { evaluateCluster } from '../research/quality.js';
import { selectHunterMission } from '../research/missions.js';

export class MintService {
  readonly pipeline: Pipeline;

  constructor(
    readonly db: DB,
    readonly rules: Rules,
    readonly radar = new ResearchRadar(),
    readonly radarConfig = RadarConfigSchema.parse({}),
  ) {
    this.pipeline = new Pipeline(db, rules);
  }

  createOpportunity(raw: unknown) {
    const input = OpportunityInputSchema.parse(raw);
    const opportunityId = id();

    this.db.transaction(tx => {
      tx.insert(tables.opportunities).values({
        id: opportunityId,
        title: input.title,
        problemStatement: input.problemStatement,
        targetUser: input.targetUser,
        synthetic: true,
        evidenceMode: 'SYNTHETIC',
        createdAt: now(),
        updatedAt: now(),
      }).run();

      for (const item of input.evidence) {
        tx.insert(tables.evidence).values({ ...item, id: id(), opportunityId }).run();
      }

      record(tx, {
        agent: 'Scout',
        action: 'SYNTHETIC_EVIDENCE_IMPORTED',
        opportunityId,
        result: { count: input.evidence.length, synthetic: true },
      });
    });

    return this.detail(opportunityId);
  }

  listOpportunities() {
    const allEvidence = this.db.select().from(tables.evidence).all();
    return this.db
      .select()
      .from(tables.opportunities)
      .orderBy(desc(tables.opportunities.createdAt))
      .all()
      .map(opportunity => {
        const items = allEvidence.filter(e => e.opportunityId === opportunity.id);
        const review = inspectEvidence(items, this.rules);
        return {
          ...opportunity,
          evidenceCount: items.length,
          acceptedEvidenceCount: review.accepted.length,
          independentCount: review.domains.length,
          independentDomains: review.domains.length,
          independentCommunities: review.communities.length,
        };
      });
  }

  detail(opportunityId: string) {
    const opportunity = this.db
      .select()
      .from(tables.opportunities)
      .where(eq(tables.opportunities.id, opportunityId))
      .get();
    if (!opportunity) throw new Error('Opportunity not found.');

    const evidence = this.db
      .select()
      .from(tables.evidence)
      .where(eq(tables.evidence.opportunityId, opportunityId))
      .all();

    return {
      ...opportunity,
      evidence,
      evidenceReview: inspectEvidence(evidence, this.rules),
      decisions: this.db
        .select()
        .from(tables.decisions)
        .where(eq(tables.decisions.opportunityId, opportunityId))
        .orderBy(desc(tables.decisions.createdAt))
        .all(),
      runs: this.db
        .select()
        .from(tables.agentRuns)
        .where(eq(tables.agentRuns.opportunityId, opportunityId))
        .orderBy(desc(tables.agentRuns.createdAt))
        .all(),
    };
  }

  listLedger() {
    return this.db.select().from(tables.ledger).orderBy(desc(tables.ledger.sequence)).all();
  }

  listExperiments() {
    const metrics = this.db.select().from(tables.metrics).all();
    return this.db
      .select()
      .from(tables.experiments)
      .orderBy(desc(tables.experiments.createdAt))
      .all()
      .map(experiment => {
        const totals = aggregateMetrics(metrics.filter(m => m.experimentId === experiment.id));
        const kill = evaluateKill({ ...totals, revenue: totals.demoRevenue, createdAt: experiment.createdAt }, this.rules);
        return { ...experiment, ...totals, kill };
      });
  }

  overview() {
    const opportunities = this.listOpportunities();
    const experiments = this.listExperiments();
    const costs = this.db.select().from(tables.costEntries).all();
    const metricRows = this.db.select().from(tables.metrics).all();
    const evidenceRows = this.db.select().from(tables.evidence).all();
    const researchSignalRows = this.db.select().from(tables.researchSignals).all();
    const researchClusterRows = this.db.select().from(tables.researchClusters).all();

    const revenue = aggregateMetrics(metricRows).verifiedRevenue;
    const externalSpend = costs.filter(c => c.category === 'EXTERNAL').reduce((n, c) => n + c.cost, 0);
    const aiSpend = costs.filter(c => c.category === 'AI_API').reduce((n, c) => n + c.cost, 0);

    return {
      discovered: opportunities.length,
      researching: opportunities.filter(o => o.status === 'RESEARCH_MORE' || o.status === 'NEW').length,
      validationCandidates: opportunities.filter(o => o.status === 'VALIDATE').length,
      activeExperiments: experiments.filter(e => e.status === 'ACTIVE').length,
      killedExperiments: experiments.filter(e => e.status === 'KILLED').length,
      externalSpend,
      aiSpend,
      revenue,
      net: revenue - externalSpend - aiSpend,
      spendLimit: 0,
      provider: 'deterministic-local',
      syntheticOnly: evidenceRows.every(e => e.synthetic),
      liveEvidenceCount: evidenceRows.filter(e => !e.synthetic).length,
      radarSignals: researchSignalRows.length,
      radarClusters: researchClusterRows.filter(c => c.status === 'PROPOSED').length,
    };
  }

  createExperiment(raw: unknown) {
    const input = ExperimentInputSchema.parse(raw);
    const opportunity = this.detail(input.opportunityId);
    if (opportunity.status !== 'VALIDATE') throw new Error('Only VALIDATE opportunities can create an internal experiment.');
    if (this.listExperiments().some(e => e.opportunityId === input.opportunityId && e.status === 'ACTIVE')) {
      throw new Error('An active experiment already exists.');
    }

    const experimentId = id();
    this.db.transaction(tx => {
      tx.insert(tables.experiments).values({
        ...input,
        id: experimentId,
        synthetic: true,
        createdAt: now(),
      }).run();
      record(tx, {
        agent: 'Director',
        action: 'EXPERIMENT_CREATED',
        opportunityId: input.opportunityId,
        experimentId,
        result: { hypothesis: input.hypothesis, synthetic: true },
      });
    });

    return this.listExperiments().find(e => e.id === experimentId)!;
  }

  addMetric(raw: unknown) {
    const input = MetricInputSchema.parse(raw);
    const experiment = this.listExperiments().find(e => e.id === input.experimentId);
    if (!experiment || experiment.status !== 'ACTIVE') throw new Error('Active experiment not found.');
    if (this.db.select().from(tables.metrics).where(eq(tables.metrics.eventId, input.eventId)).get()) {
      throw new Error('Duplicate metric event; already recorded.');
    }

    this.db.transaction(tx => {
      tx.insert(tables.metrics).values({
        ...input,
        id: id(),
        verified: false,
        createdAt: now(),
      }).run();
      record(tx, {
        agent: 'Analytics',
        action: 'SYNTHETIC_METRIC_RECORDED',
        experimentId: experiment.id,
        opportunityId: experiment.opportunityId,
        result: input,
      });
    });

    return this.listExperiments().find(e => e.id === experiment.id)!;
  }

  evaluateExperiment(experimentId: string, apply = false) {
    const experiment = this.listExperiments().find(e => e.id === experimentId);
    if (!experiment || experiment.status !== 'ACTIVE') throw new Error('Active experiment not found.');

    this.db.transaction(tx => {
      if (apply && experiment.kill.recommendation === 'KILL') {
        tx.update(tables.experiments)
          .set({ status: 'KILLED', endedAt: now() })
          .where(eq(tables.experiments.id, experimentId))
          .run();
      }
      record(tx, {
        agent: 'Kill Engine',
        action: apply && experiment.kill.recommendation === 'KILL' ? 'EXPERIMENT_KILLED' : 'KILL_EVALUATED',
        experimentId,
        opportunityId: experiment.opportunityId,
        decision: experiment.kill.recommendation,
        result: experiment.kill,
      });
    });

    return experiment.kill;
  }

  requestAction(raw: unknown) {
    const input = z.object({
      action: z.string().min(1),
      mayCostMoney: z.boolean().default(false),
    }).strict().parse(raw);

    const result = authorize(input.action, input.mayCostMoney);
    record(this.db, {
      agent: 'Authority',
      action: 'AUTHORITY_CHECK',
      decision: result.status,
      result: { ...input, ...result },
    });
    return result;
  }

  createDistribution(raw: unknown) {
    const input = z.object({
      experimentId: z.string(),
      channel: z.string().trim().min(3).max(300),
      message: z.string().trim().min(12).max(3000),
    }).strict().parse(raw);

    const experiment = this.listExperiments().find(e => e.id === input.experimentId && e.status === 'ACTIVE');
    if (!experiment) throw new Error('Active experiment not found.');

    const entry = { ...input, id: id(), status: 'REQUIRES_OWNER_APPROVAL', createdAt: now() };
    this.db.transaction(tx => {
      tx.insert(tables.distributionExperiments).values(entry).run();
      record(tx, {
        agent: 'Distribution',
        action: 'DISTRIBUTION_DRAFTED',
        experimentId: experiment.id,
        opportunityId: experiment.opportunityId,
        decision: entry.status,
        result: { ...entry, executed: false },
      });
    });
    return entry;
  }

  createBuilderJob(raw: unknown) {
    const input = z.object({
      opportunityId: z.string(),
      specification: z.string().trim().min(12).max(5000),
    }).strict().parse(raw);

    this.detail(input.opportunityId);
    const job = { ...input, id: id(), status: 'DISABLED', createdAt: now() };
    this.db.transaction(tx => {
      tx.insert(tables.builderJobs).values(job).run();
      record(tx, {
        agent: 'Builder',
        action: 'DISABLED_JOB_RECORDED',
        opportunityId: input.opportunityId,
        result: job,
      });
    });
    return job;
  }

  listResearchSignals() {
    return this.db.select().from(tables.researchSignals).orderBy(desc(tables.researchSignals.collectedAt)).all();
  }

  listResearchClusters() {
    const signals = this.listResearchSignals();
    return this.db
      .select()
      .from(tables.researchClusters)
      .orderBy(desc(tables.researchClusters.updatedAt))
      .all()
      .map(cluster => ({ ...cluster, quality: evaluateCluster(cluster, signals) }));
  }

  listRadarRuns() {
    return this.db.select().from(tables.radarRuns).orderBy(desc(tables.radarRuns.createdAt)).all();
  }

  async runRadar(raw: unknown) {
    const authority = authorize('research');
    if (!authority.executable) throw new Error('Research authority is disabled.');

    const input = z.object({
      queries: z.array(z.string().trim().min(3).max(120)).min(1).max(this.radarConfig.maxQueries).default(DEFAULT_QUERIES),
      perSourceLimit: z.number().int().min(1).max(this.radarConfig.perSourceLimit).default(this.radarConfig.perSourceLimit),
    }).strict().parse(raw ?? {});

    const latest = this.listRadarRuns()[0];
    if (latest) {
      const elapsed = Date.now() - new Date(latest.createdAt).getTime();
      const cooldown = this.radarConfig.cooldownMinutes * 60_000;
      if (elapsed < cooldown) {
        const seconds = Math.ceil((cooldown - elapsed) / 1000);
        throw new Error(`Research Radar cooldown active. Try again in about ${seconds} seconds.`);
      }
    }

    const result = await this.radar.run(input.queries, input.perSourceLimit);
    const collectedAt = now();
    const status = result.errors.length === 0 ? 'SUCCESS' : result.signals.length > 0 ? 'PARTIAL' : 'FAILED';

    this.db.transaction(tx => {
      for (const signal of result.signals) {
        const exists = tx.select().from(tables.researchSignals).where(eq(tables.researchSignals.id, signal.id)).get();
        if (!exists) tx.insert(tables.researchSignals).values({ ...signal, collectedAt }).run();
      }

      for (const cluster of result.clusters) {
        const exists = tx.select().from(tables.researchClusters).where(eq(tables.researchClusters.id, cluster.id)).get();
        if (!exists) {
          tx.insert(tables.researchClusters).values({
            ...cluster,
            status: 'PROPOSED',
            createdAt: collectedAt,
            updatedAt: collectedAt,
          }).run();
        }
      }

      tx.insert(tables.radarRuns).values({
        id: id(),
        status,
        queries: input.queries,
        requestCount: result.requestCount,
        signalCount: result.signals.length,
        clusterCount: result.clusters.length,
        errors: result.errors,
        createdAt: collectedAt,
      }).run();

      record(tx, {
        agent: 'Research Radar',
        action: 'RADAR_RUN_COMPLETED',
        result: {
          status,
          queries: input.queries,
          requests: result.requestCount,
          signals: result.signals.length,
          clusters: result.clusters.length,
          errors: result.errors,
          spend: 0,
        },
      });
    });

    return {
      status,
      queries: input.queries,
      requestCount: result.requestCount,
      signalCount: result.signals.length,
      clusterCount: result.clusters.length,
      errors: result.errors,
      spend: 0,
      clusters: this.listResearchClusters().filter(cluster => result.clusters.some(item => item.id === cluster.id)),
    };
  }

  async runHunter(raw: unknown = {}) {
    const input = z.object({
      autoPromote: z.boolean().default(true),
    }).strict().parse(raw ?? {});

    const mission = selectHunterMission(this.listRadarRuns().length);
    const radarResult = await this.runRadar({
      queries: mission.queries,
      perSourceLimit: this.radarConfig.perSourceLimit,
    });

    const eligible = radarResult.clusters
      .filter(cluster => cluster.status === 'PROPOSED' && cluster.quality.autoPromoteEligible)
      .sort((a, b) => b.quality.score - a.quality.score);

    const promotedOpportunityIds: string[] = [];
    if (input.autoPromote && eligible.length) {
      const promoted = await this.promoteResearchCluster(eligible[0].id);
      promotedOpportunityIds.push(promoted.id);
    }

    record(this.db, {
      agent: 'Opportunity Hunter',
      action: 'HUNTER_MISSION_COMPLETED',
      decision: promotedOpportunityIds.length ? 'PROMOTED_INTERNAL_CANDIDATE' : 'NO_STRONG_CANDIDATE',
      result: {
        mission,
        signals: radarResult.signalCount,
        clusters: radarResult.clusterCount,
        eligibleClusters: eligible.map(cluster => ({ id: cluster.id, score: cluster.quality.score })),
        promotedOpportunityIds,
        externalActions: 0,
        spend: 0,
      },
    });

    return {
      mission,
      ...radarResult,
      eligibleClusterCount: eligible.length,
      promotedOpportunityIds,
      externalActions: 0,
      spend: 0,
    };
  }

  async promoteResearchCluster(clusterId: string) {
    const cluster = this.db
      .select()
      .from(tables.researchClusters)
      .where(eq(tables.researchClusters.id, clusterId))
      .get();
    if (!cluster) throw new Error('Research cluster not found.');
    if (cluster.status !== 'PROPOSED') throw new Error('Only PROPOSED research clusters can be promoted.');

    const idSet = new Set(cluster.signalIds);
    const signals = this.listResearchSignals().filter(signal => idSet.has(signal.id));
    if (signals.length < 3) throw new Error('Cluster no longer has enough source signals to promote.');

    const opportunityId = id();
    const createdAt = now();

    this.db.transaction(tx => {
      tx.insert(tables.opportunities).values({
        id: opportunityId,
        title: cluster.title,
        problemStatement: cluster.problemStatement,
        targetUser: cluster.targetUser,
        synthetic: true,
        evidenceMode: 'LIVE',
        createdAt,
        updatedAt: createdAt,
      }).run();

      for (const signal of signals) {
        tx.insert(tables.evidence).values({
          id: id(),
          opportunityId,
          sourceUrl: signal.sourceUrl,
          sourceType: signal.sourceType,
          excerpt: signal.excerpt,
          signalType: SignalSchema.parse(signal.signalType),
          sourceIdentity: signal.sourceIdentity,
          community: signal.community,
          capturedAt: signal.capturedAt,
          confidence: signal.confidence,
          synthetic: false,
        }).run();
      }

      tx.update(tables.researchClusters)
        .set({ status: 'PROMOTED', updatedAt: createdAt })
        .where(eq(tables.researchClusters.id, clusterId))
        .run();

      record(tx, {
        agent: 'Research Radar',
        action: 'LIVE_CLUSTER_PROMOTED',
        opportunityId,
        evidenceIds: signals.map(signal => signal.id),
        result: {
          clusterId,
          liveSignals: signals.length,
          sourceCount: cluster.sourceCount,
          domainCount: cluster.domainCount,
          spend: 0,
        },
      });
    });

    await this.pipeline.run(opportunityId);
    return this.detail(opportunityId);
  }
}
