import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../database/index.js';
import { agentRuns, costEntries, decisions, evidence as evidenceTable, opportunities } from '../database/schema.js';
import { AnalysisSchema, DirectorSchema, PalermoSchema, ScoresSchema, type Evidence } from '../models/index.js';
import type { Rules } from '../config/index.js';
import { scout } from '../agents/scout/index.js';
import { analyze } from '../agents/analyst/index.js';
import { score } from '../agents/scorer/index.js';
import { challenge } from '../agents/palermo/index.js';
import { decide } from '../agents/director/index.js';
import { DeterministicLocalProvider, type LLMProvider } from '../providers/index.js';
import { record } from '../ledger/index.js';
import { id, now } from '../shared/identity.js';

export class Pipeline {
  private running = new Set<string>();
  constructor(private db: DB, private rules: Rules, private provider: LLMProvider = new DeterministicLocalProvider()) {}
  async run(opportunityId: string) {
    if (this.running.has(opportunityId)) throw new Error('Pipeline already running for this opportunity.');
    const opportunity = this.db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).get();
    if (!opportunity) throw new Error('Opportunity not found.');
    this.running.add(opportunityId);
    const all = this.db.select().from(evidenceTable).where(eq(evidenceTable.opportunityId, opportunityId)).all() as Evidence[];
    const execute = async <T>(agent: string, input: unknown, schema: z.ZodType<T>, local: () => unknown) => {
      const start = performance.now(), runId = id();
      try {
        const result = await this.provider.generateStructured({ task: agent, input, schema, local });
        if (result.estimatedCost !== 0) throw new Error('Provider violated SPEND_LIMIT = 0.');
        const output = schema.parse(result.output);
        this.db.transaction(tx => {
          tx.insert(agentRuns).values({ id: runId, opportunityId, agent, provider: this.provider.name, input, output, duration: Math.round(performance.now() - start), estimatedTokens: result.estimatedTokens, estimatedCost: 0, status: 'SUCCESS', createdAt: now() }).run();
          tx.insert(costEntries).values({ id: id(), agentRunId: runId, category: 'AI_API', cost: 0, description: `${agent}: local computation`, createdAt: now() }).run();
          record(tx, { agent, action: 'AGENT_COMPLETED', opportunityId, evidenceIds: all.map(e => e.id), result: output });
        });
        return output;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.db.transaction(tx => {
          tx.insert(agentRuns).values({ id: runId, opportunityId, agent, provider: this.provider.name, input, duration: Math.round(performance.now() - start), estimatedTokens: 0, estimatedCost: 0, status: 'FAILED', error: message, createdAt: now() }).run();
          record(tx, { agent, action: 'AGENT_FAILED', opportunityId, result: { error: message } });
        });
        throw error;
      }
    };
    try {
      const scoutResult = await execute('Scout', { evidence: all, rules: this.rules }, z.custom<ReturnType<typeof scout>>(v => !!v && typeof v === 'object' && 'accepted' in v), () => scout(all, this.rules));
      // Only trusted local filtering feeds gates. Provider output cannot add evidence or bypass rules.
      const accepted = scout(all, this.rules).accepted;
      const analysis = await execute('Analyst', { evidence: accepted, targetUser: opportunity.targetUser }, AnalysisSchema, () => analyze(accepted, opportunity.targetUser));
      await execute('Scorer', { evidence: accepted, rules: this.rules }, ScoresSchema, () => score(accepted, this.rules));
      const scores = score(accepted, this.rules);
      await execute('Palermo', { evidence: all, accepted, rejected: scoutResult.rejected }, PalermoSchema, () => challenge(all, accepted, scoutResult.rejected));
      const palermo = challenge(all, accepted, scout(all, this.rules).rejected);
      await execute('Director', { evidence: accepted, scores, palermo, rules: this.rules, validationPassed: false }, DirectorSchema, () => decide(accepted, scores, palermo, this.rules));
      // Final authoritative decision is always deterministic; model output is advisory only.
      const decision = decide(accepted, scores, palermo, this.rules);
      this.db.transaction(tx => {
        tx.update(opportunities).set({ status: decision.decision, scores, analysis, palermo, demandScore: scores.demand.value, urgencyScore: scores.urgency.value, willingnessToPayScore: scores.willingnessToPay.value, competitionScore: scores.competition.value, buildComplexityScore: scores.buildComplexity.value, distributionScore: scores.distribution.value, recurringScore: scores.recurring.value, totalScore: scores.total, palermoVerdict: palermo.verdict, updatedAt: now() }).where(eq(opportunities.id, opportunityId)).run();
        tx.insert(decisions).values({ id: id(), opportunityId, decision: decision.decision, detail: decision, createdAt: now() }).run();
        record(tx, { agent: 'Director', action: 'DECISION_RECORDED', opportunityId, decision: decision.decision, evidenceIds: accepted.map(e => e.id), result: decision });
      });
      return decision;
    } finally { this.running.delete(opportunityId); }
  }
}
