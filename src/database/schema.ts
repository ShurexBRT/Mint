import { sqliteTable, text, integer, real, check, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { Analysis, DirectorResult, PalermoResult, Scores } from '../models/index.js';

export const opportunities = sqliteTable('opportunities', {
  id: text('id').primaryKey(), title: text('title').notNull(), problemStatement: text('problem_statement').notNull(), targetUser: text('target_user').notNull(),
  status: text('status', { enum: ['NEW', 'RESEARCH_MORE', 'VALIDATE', 'BUILD', 'KILL'] }).notNull().default('NEW'),
  synthetic: integer('synthetic', { mode: 'boolean' }).notNull().default(true),
  demandScore: real('demand_score').notNull().default(0), urgencyScore: real('urgency_score').notNull().default(0), willingnessToPayScore: real('willingness_to_pay_score').notNull().default(0),
  competitionScore: real('competition_score').notNull().default(0), buildComplexityScore: real('build_complexity_score').notNull().default(0), distributionScore: real('distribution_score').notNull().default(0), recurringScore: real('recurring_score').notNull().default(0), totalScore: real('total_score').notNull().default(0),
  palermoVerdict: text('palermo_verdict').notNull().default('PENDING'),
  scores: text('scores', { mode: 'json' }).$type<Scores>(), analysis: text('analysis', { mode: 'json' }).$type<Analysis>(), palermo: text('palermo', { mode: 'json' }).$type<PalermoResult>(),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const evidence = sqliteTable('evidence', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => opportunities.id),
  sourceUrl: text('source_url').notNull(), sourceType: text('source_type', { enum: ['forum', 'review', 'issue', 'interview', 'research'] }).notNull(),
  excerpt: text('excerpt').notNull(), signalType: text('signal_type', { enum: ['pain', 'urgency', 'willingness_to_pay', 'alternative', 'distribution', 'recurring', 'feasibility', 'commodity', 'legal_risk', 'security_risk', 'privacy_risk', 'platform_risk'] }).notNull(),
  sourceIdentity: text('source_identity').notNull(), community: text('community').notNull(), capturedAt: text('captured_at').notNull(), confidence: real('confidence').notNull(), synthetic: integer('synthetic', { mode: 'boolean' }).notNull().default(true), complexityEstimate: integer('complexity_estimate'),
}, t => [index('evidence_opportunity_idx').on(t.opportunityId)]);
export const agentRuns = sqliteTable('agent_runs', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => opportunities.id), agent: text('agent').notNull(), provider: text('provider').notNull(),
  input: text('input', { mode: 'json' }).$type<unknown>().notNull(), output: text('output', { mode: 'json' }).$type<unknown>(), duration: integer('duration').notNull(), estimatedTokens: integer('estimated_tokens').notNull().default(0),
  estimatedCost: real('estimated_cost').notNull().default(0), status: text('status', { enum: ['SUCCESS', 'FAILED'] }).notNull(), error: text('error'), createdAt: text('created_at').notNull(),
}, t => [check('agent_cost_zero', sql`${t.estimatedCost} = 0`)]);
export const decisions = sqliteTable('decisions', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => opportunities.id),
  decision: text('decision', { enum: ['RESEARCH_MORE', 'VALIDATE', 'BUILD', 'KILL'] }).notNull(),
  detail: text('detail', { mode: 'json' }).$type<DirectorResult>().notNull(), createdAt: text('created_at').notNull(),
});
export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => opportunities.id), hypothesis: text('hypothesis').notNull(),
  status: text('status', { enum: ['ACTIVE', 'KILLED'] }).notNull().default('ACTIVE'), synthetic: integer('synthetic', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull(), endedAt: text('ended_at'),
});
export const metrics = sqliteTable('metrics', {
  id: text('id').primaryKey(), experimentId: text('experiment_id').notNull().references(() => experiments.id), eventId: text('event_id').notNull().unique(),
  visits: integer('visits').notNull(), signups: integer('signups').notNull(), purchases: integer('purchases').notNull(), revenue: real('revenue').notNull(),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false), synthetic: integer('synthetic', { mode: 'boolean' }).notNull().default(true), createdAt: text('created_at').notNull(),
}, t => [check('metric_demo_only', sql`${t.synthetic} = 1 AND ${t.verified} = 0`), check('metric_nonnegative', sql`${t.visits} >= ${t.signups} AND ${t.signups} >= ${t.purchases} AND ${t.purchases} >= 0 AND ${t.revenue} >= 0`)]);
export const costEntries = sqliteTable('cost_entries', {
  id: text('id').primaryKey(), agentRunId: text('agent_run_id').references(() => agentRuns.id), cost: real('cost').notNull().default(0), category: text('category', { enum: ['AI_API', 'EXTERNAL'] }).notNull(), description: text('description').notNull(), createdAt: text('created_at').notNull(),
}, t => [check('cost_zero', sql`${t.cost} = 0`)]);
export const ledger = sqliteTable('ledger', {
  sequence: integer('sequence').primaryKey({ autoIncrement: true }), id: text('id').notNull().unique(), agent: text('agent').notNull(), opportunityId: text('opportunity_id').references(() => opportunities.id), experimentId: text('experiment_id').references(() => experiments.id),
  action: text('action').notNull(), costEstimate: real('cost_estimate').notNull().default(0), evidenceIds: text('evidence_ids', { mode: 'json' }).$type<string[]>().notNull(), decision: text('decision'), result: text('result', { mode: 'json' }).$type<unknown>().notNull(), createdAt: text('created_at').notNull(),
}, t => [check('ledger_cost_zero', sql`${t.costEstimate} = 0`)]);
export const builderJobs = sqliteTable('builder_jobs', {
  id: text('id').primaryKey(), opportunityId: text('opportunity_id').notNull().references(() => opportunities.id), status: text('status').notNull().default('DISABLED'), specification: text('specification').notNull(), createdAt: text('created_at').notNull(),
});
export const distributionExperiments = sqliteTable('distribution_experiments', {
  id: text('id').primaryKey(), experimentId: text('experiment_id').notNull().references(() => experiments.id), channel: text('channel').notNull(), message: text('message').notNull(), status: text('status').notNull().default('REQUIRES_OWNER_APPROVAL'), createdAt: text('created_at').notNull(),
});
