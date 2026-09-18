import { DirectorSchema, type Evidence, type PalermoResult, type Scores } from '../../models/index.js';
import { sourceDomain } from '../../evidence/validate.js';
import type { Rules } from '../../config/index.js';
export function decide(evidence: Evidence[], scores: Scores, palermo: PalermoResult, rules: Rules, validationPassed = false) {
  const blockers: string[] = [];
  if (evidence.length < rules.minEvidence) blockers.push(`Need ${rules.minEvidence} independent evidence items; have ${evidence.length}.`);
  if (new Set(evidence.map(e => sourceDomain(e.sourceUrl))).size < rules.minDomains) blockers.push(`Need ${rules.minDomains} independent domains.`);
  if (new Set(evidence.map(e => e.community.trim().toLowerCase())).size < 2) blockers.push('Need multiple independent communities.');
  if (!evidence.some(e => ['pain', 'urgency'].includes(e.signalType))) blockers.push('No pain or urgency evidence.');
  if (!evidence.some(e => e.signalType === 'distribution')) blockers.push('No plausible distribution channel.');
  if (palermo.verdict === 'VETO') blockers.push('Palermo veto blocks BUILD. Phase 1 has no owner override endpoint.');
  if (palermo.critical) blockers.push('Critical risk must be resolved; cannot be overridden.');
  if (!validationPassed) blockers.push('Validation must pass before BUILD.');
  if (evidence.some(e => e.synthetic)) blockers.push('Synthetic evidence cannot authorize BUILD.');
  let decision: 'RESEARCH_MORE' | 'VALIDATE' | 'BUILD' | 'KILL' = 'RESEARCH_MORE';
  const reasons: string[] = [];
  if (palermo.verdict === 'VETO') { decision = 'KILL'; reasons.push(...palermo.reasons); }
  else if (!blockers.length && scores.total >= rules.buildScore) { decision = 'BUILD'; reasons.push('All gates and validation passed.'); }
  else if (evidence.length >= rules.minEvidence && new Set(evidence.map(e => sourceDomain(e.sourceUrl))).size >= rules.minDomains && new Set(evidence.map(e => e.community.trim().toLowerCase())).size >= 2 && scores.total >= rules.validateScore && scores.urgency.value > 0 && scores.distribution.value > 0) {
    decision = 'VALIDATE'; reasons.push('Evidence meets research threshold. Run a small validation experiment before any build.');
  } else reasons.push("I don't have enough evidence. Collect independent pain, buying-intent, and distribution signals.");
  return DirectorSchema.parse({ decision, reasons, blockers, evidenceIds: evidence.map(e => e.id) });
}
