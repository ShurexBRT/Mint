import { ScoresSchema, type Evidence } from '../../models/index.js';
import type { Rules } from '../../config/index.js';
export function score(evidence: Evidence[], rules: Rules) {
  const complexity = evidence.filter(e => e.signalType === 'feasibility' && e.complexityEstimate != null);
  const dimension = (types: Evidence['signalType'][], label: string) => {
    const items = evidence.filter(e => types.includes(e.signalType));
    return { value: Math.round(Math.min(100, items.reduce((n, e) => n + e.confidence, 0) / rules.targetSignals * 100)), evidenceIds: items.map(e => e.id),
      reason: items.length ? `${label}: ${items.length} independent signals, confidence weighted; target ${rules.targetSignals}.` : `${label}: unknown; no supporting evidence (0).` };
  };
  const result = {
    demand: dimension(['pain', 'urgency', 'willingness_to_pay'], 'Demand'),
    urgency: dimension(['urgency', 'pain'], 'Pain / urgency'),
    willingnessToPay: dimension(['willingness_to_pay'], 'Buying intent'),
    competition: dimension(['alternative', 'commodity'], 'Competition pressure; higher means more competition'),
    buildComplexity: { value: complexity.length ? Math.round(complexity.reduce((n, e) => n + e.complexityEstimate! * 20 * e.confidence, 0) / complexity.reduce((n, e) => n + e.confidence, 0)) : 0, evidenceIds: complexity.map(e => e.id), reason: complexity.length ? 'Confidence-weighted difficulty estimate (1–5) × 20. Higher means harder.' : 'Unknown difficulty: no explicit complexity estimate supplied (0 is not easy).' },
    distribution: dimension(['distribution'], 'Permission-based distribution'),
    recurring: dimension(['recurring'], 'Recurring need'),
  };
  // Competition is disclosed separately; absent competition research never awards points.
  const total = Math.round(result.demand.value * .3 + result.urgency.value * .2 + result.willingnessToPay.value * .2 + result.distribution.value * .15 + (complexity.length ? 100 - result.buildComplexity.value : 0) * .1 + result.recurring.value * .05);
  return ScoresSchema.parse({ ...result, total });
}
