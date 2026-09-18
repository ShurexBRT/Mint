import { DirectorSchema, type Evidence, type PalermoResult, type Scores } from '../../models/index.js';
import { sourceDomain } from '../../evidence/validate.js';
import type { Rules } from '../../config/index.js';

export function decide(
  evidence: Evidence[],
  scores: Scores,
  palermo: PalermoResult,
  rules: Rules,
  validationPassed = false,
) {
  const blockers: string[] = [];
  const domains = new Set(evidence.map(e => sourceDomain(e.sourceUrl))).size;
  const communities = new Set(evidence.map(e => e.community.trim().toLowerCase())).size;
  const hasPain = evidence.some(e => ['pain', 'urgency'].includes(e.signalType));
  const hasDistribution = evidence.some(e => e.signalType === 'distribution');
  const hasBuyingIntent = evidence.some(e => e.signalType === 'willingness_to_pay');

  if (evidence.length < rules.minEvidence) blockers.push(`Need ${rules.minEvidence} independent evidence items; have ${evidence.length}.`);
  if (domains < rules.minDomains) blockers.push(`Need ${rules.minDomains} independent domains.`);
  if (communities < 2) blockers.push('Need multiple independent communities.');
  if (!hasPain) blockers.push('No pain or urgency evidence.');
  if (!hasDistribution) blockers.push('No explicit distribution evidence yet; required before BUILD.');
  if (!hasBuyingIntent) blockers.push('No explicit willingness-to-pay evidence.');
  if (palermo.verdict === 'VETO') blockers.push('Palermo veto blocks BUILD. Phase 2 has no owner override endpoint.');
  if (palermo.critical) blockers.push('Critical risk must be resolved; cannot be overridden.');
  if (!validationPassed) blockers.push('Validation must pass before BUILD.');
  if (evidence.some(e => e.synthetic)) blockers.push('Synthetic evidence cannot authorize BUILD.');

  let decision: 'RESEARCH_MORE' | 'VALIDATE' | 'BUILD' | 'KILL' = 'RESEARCH_MORE';
  const reasons: string[] = [];

  if (palermo.verdict === 'VETO') {
    decision = 'KILL';
    reasons.push(...palermo.reasons);
  } else if (!blockers.length && scores.total >= rules.buildScore) {
    decision = 'BUILD';
    reasons.push('All gates and validation passed.');
  } else if (
    evidence.length >= rules.minEvidence &&
    domains >= rules.minDomains &&
    communities >= 2 &&
    scores.total >= rules.validateScore &&
    scores.urgency.value > 0 &&
    hasBuyingIntent
  ) {
    decision = 'VALIDATE';
    reasons.push('Evidence is strong enough to justify a small validation experiment. Distribution evidence is still required before BUILD.');
  } else {
    reasons.push("I don't have enough commercial evidence. Collect independent pain and buying-intent signals before validation.");
  }

  return DirectorSchema.parse({
    decision,
    reasons,
    blockers,
    evidenceIds: evidence.map(e => e.id),
  });
}
