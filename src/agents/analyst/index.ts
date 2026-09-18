import { AnalysisSchema, type Evidence } from '../../models/index.js';
export function analyze(evidence: Evidence[], targetUser: string) {
  const groups = Map.groupBy(evidence, e => e.signalType);
  return AnalysisSchema.parse({ targetUser,
    repeatedProblems: [...groups.entries()].map(([signal, items]) => ({ signal, evidenceIds: items.map(e => e.id) })),
    alternatives: evidence.filter(e => e.signalType === 'alternative' || e.signalType === 'commodity').map(e => e.excerpt),
    complexitySummary: evidence.filter(e => e.signalType === 'feasibility').map(e => e.excerpt).join(' ') || 'Unknown: no feasibility evidence supplied.',
  });
}
