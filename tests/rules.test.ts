import { describe, expect, it } from 'vitest';
import { defaultRules, readConfig, RulesSchema } from '../src/config/index';
import { demoInputs } from '../src/database/demo';
import { inspectEvidence, sourceDomain } from '../src/evidence/validate';
import { score } from '../src/agents/scorer/index';
import { challenge } from '../src/agents/palermo/index';
import { decide } from '../src/agents/director/index';
import { authorize, actions } from '../src/engine/authority';
import { evaluateKill } from '../src/experiments/kill';
import { aggregateMetrics } from '../src/experiments/analytics';
import { CostEntryInputSchema, EvidenceInputSchema, MetricInputSchema, OpportunityInputSchema, type Evidence } from '../src/models/index';
const evidence = (): Evidence[] => demoInputs[0].evidence.map((e, i) => ({ ...e, id: `e${i}`, opportunityId: 'op' }));
const pass = { verdict: 'PASS' as const, critical: false, reasons: [], evidenceIds: [] };
describe('independent evidence', () => {
  it('rejects tracking aliases, duplicate people and copied excerpts', () => {
    const base = evidence()[0];
    const result = inspectEvidence([base, { ...base, id: 'alias', sourceUrl: `${base.sourceUrl}?utm_source=x#reply`, sourceIdentity: 'other', excerpt: 'A distinct excerpt still points to the same URL.' }, { ...base, id: 'person', sourceUrl: 'https://example.org/other', excerpt: 'Different text from the same source identity.' }, { ...base, id: 'copy', sourceUrl: 'https://example.net/new', sourceIdentity: 'another' }], defaultRules);
    expect(result.accepted).toHaveLength(1); expect(result.rejected).toHaveLength(3);
  });
  it('groups subdomains under the registrable domain, including co.uk', () => { expect(sourceDomain('https://a.example.co.uk/x')).toBe('example.co.uk'); expect(sourceDomain('https://b.example.co.uk/x')).toBe('example.co.uk'); });
  it('excludes private hosts, low confidence, and future timestamps', () => { const base = evidence()[0]; for (const patch of [{ sourceUrl: 'http://127.0.0.1/x' }, { sourceUrl: 'http://10.0.0.2/x' }, { confidence: .1 }, { capturedAt: '2099-01-01T00:00:00.000Z' }]) expect(inspectEvidence([{ ...base, ...patch }], defaultRules).accepted).toHaveLength(0); });
});
describe('scoring and Director', () => {
  it('gives empty evidence zero support and asks for research', () => { const scores = score([], defaultRules); expect(scores.total).toBe(0); expect(scores.demand.evidenceIds).toEqual([]); expect(decide([], scores, pass, defaultRules).decision).toBe('RESEARCH_MORE'); });
  it('links scores to the correct evidence and reports difficulty in the right direction', () => { const input = evidence(); const result = score(input, defaultRules); expect(result.demand.evidenceIds).toHaveLength(9); expect(result.willingnessToPay.evidenceIds).toHaveLength(4); expect(result.buildComplexity.value).toBe(40); expect(result.buildComplexity.evidenceIds).toEqual(['e12']); expect(result.total).toBeGreaterThanOrEqual(defaultRules.validateScore); expect(decide(input, result, pass, defaultRules).decision).toBe('VALIDATE'); });
  it('allows configurable stricter thresholds', () => { const rules = RulesSchema.parse({ validateScore: 99, buildScore: 100 }); expect(decide(evidence(), score(evidence(), rules), pass, rules).decision).toBe('RESEARCH_MORE'); });
  it('requires explicit buying intent before VALIDATE', () => { const input = evidence().filter(e => e.signalType !== 'willingness_to_pay'); expect(decide(input, score(input, defaultRules), pass, defaultRules).decision).toBe('RESEARCH_MORE'); });
  it('never builds from synthetic evidence even with validation and maximum scores', () => { const input = evidence(); const result = decide(input, { ...score(input, defaultRules), total: 100 }, pass, defaultRules, true); expect(result.blockers).toContain('Synthetic evidence cannot authorize BUILD.'); expect(result.decision).not.toBe('BUILD'); });
  it.each(['few', 'one-domain', 'one-community', 'no-pain', 'no-distribution', 'no-validation'])('cannot bypass gate: %s', gate => {
    let input = evidence().map(e => ({ ...e, synthetic: false }));
    if (gate === 'few') input = input.slice(0, 4);
    if (gate === 'one-domain') input = input.map((e, i) => ({ ...e, sourceUrl: `https://example.org/${i}` }));
    if (gate === 'one-community') input = input.map(e => ({ ...e, community: 'same community' }));
    if (gate === 'no-pain') input = input.filter(e => !['pain', 'urgency'].includes(e.signalType));
    if (gate === 'no-distribution') input = input.filter(e => e.signalType !== 'distribution');
    const result = decide(input, { ...score(input, defaultRules), total: 100 }, pass, defaultRules, gate !== 'no-validation');
    expect(result.decision).not.toBe('BUILD'); expect(result.blockers.length).toBeGreaterThan(0);
  });
  it('permits future BUILD only when all explicit gates pass with non-synthetic validated evidence', () => { const input = evidence().map(e => ({ ...e, synthetic: false })); expect(decide(input, { ...score(input, defaultRules), total: 100 }, pass, defaultRules, true).decision).toBe('BUILD'); });
});
describe('Palermo veto', () => {
  it.each(['legal_risk', 'security_risk', 'privacy_risk', 'platform_risk'] as const)('keeps %s even on low-confidence duplicate evidence', risk => {
    const input = [...evidence(), { ...evidence()[0], id: 'risk', signalType: risk, confidence: .01 }];
    const review = inspectEvidence(input, defaultRules); const verdict = challenge(input, review.accepted, review.rejected);
    expect(verdict.verdict).toBe('VETO'); expect(verdict.critical).toBe(true); expect(decide(review.accepted, score(review.accepted, defaultRules), verdict, defaultRules, true).decision).toBe('KILL');
  });
  it('treats commodity pressure as caution unless a critical risk exists', () => { const input = [{ ...evidence()[0], signalType: 'commodity' as const }]; expect(challenge(input, input, []).verdict).toBe('CAUTION'); expect(challenge([], [], []).verdict).toBe('CAUTION'); });
});
describe('financial authority and validation', () => {
  it('cannot configure positive, negative, or invalid spending limits', () => { for (const value of ['1', '-1', 'NaN', 'Infinity']) expect(() => readConfig({ SPEND_LIMIT: value })).toThrow(); expect(readConfig({}).spendLimit).toBe(0); });
  it('cannot weaken minimum evidence requirements', () => { expect(() => RulesSchema.parse({ minEvidence: 4 })).toThrow(); expect(() => RulesSchema.parse({ minDomains: 1 })).toThrow(); });
  it('denies unknown actions and spending on every action', () => { expect(authorize('unknown').status).toBe('PROHIBITED'); for (const action of actions) expect(authorize(action, true).executable).toBe(false); });
  it.each(['purchase', 'paid_api', 'paid_domain', 'paid_hosting', 'paid_data', 'subscription', 'paid_advertising', 'billed_cloud'])('%s never executes', action => { expect(authorize(action)).toMatchObject({ status: 'REQUIRES_OWNER_APPROVAL', executable: false }); });
  it('prohibits trading and deception even when spending is flagged', () => { for (const action of ['financial_trading', 'crypto_trading', 'gambling', 'spam', 'deception']) expect(authorize(action, true).status).toBe('PROHIBITED'); });
  it('validates synthetic-only schemas and cost zero', () => {
    expect(OpportunityInputSchema.parse(demoInputs[0]).evidence).toHaveLength(15);
    expect(() => EvidenceInputSchema.parse({ ...demoInputs[0].evidence[0], synthetic: false })).toThrow();
    expect(() => EvidenceInputSchema.parse({ ...demoInputs[0].evidence[0], sourceUrl: 'file:///secret' })).toThrow();
    expect(CostEntryInputSchema.parse({ category: 'AI_API', description: 'Local run' }).cost).toBe(0);
    expect(() => CostEntryInputSchema.parse({ cost: .01, category: 'AI_API', description: 'Paid run' })).toThrow();
    expect(() => MetricInputSchema.parse({ experimentId: 'e', eventId: 'abc', visits: 0, signups: 3, purchases: 1, revenue: 10, synthetic: true })).toThrow();
  });
});
describe('kill engine and revenue', () => {
  const at = new Date('2026-02-01T00:00:00Z');
  it('kills at exact time/traffic boundaries and does not kill one millisecond early', () => {
    const input = { createdAt: new Date(at.getTime() - 14 * 86400000).toISOString(), visits: 100, signups: 2, purchases: 0, revenue: 0 };
    expect(evaluateKill(input, defaultRules, at).recommendation).toBe('KILL'); expect(evaluateKill(input, defaultRules, new Date(at.getTime() - 1)).recommendation).toBe('CONTINUE'); expect(evaluateKill({ ...input, signups: 3 }, defaultRules, at).recommendation).toBe('CONTINUE');
  });
  it('ends experiments with no purchases at the hard time limit even without traffic', () => { expect(evaluateKill({ createdAt: '2026-01-01T00:00:00Z', visits: 0, signups: 0, purchases: 0, revenue: 0 }, defaultRules, at).recommendation).toBe('KILL'); });
  it('never counts synthetic or unverified revenue as external revenue', () => { const row = { visits: 100, signups: 10, purchases: 1, revenue: 20, synthetic: true, verified: true }; expect(aggregateMetrics([row]).verifiedRevenue).toBe(0); expect(aggregateMetrics([{ ...row, synthetic: false, verified: false }]).verifiedRevenue).toBe(0); expect(aggregateMetrics([]).conversion).toBe(0); });
});
