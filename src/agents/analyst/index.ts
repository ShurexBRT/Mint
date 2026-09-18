import { AnalysisSchema, type Evidence } from '../../models/index.js';

export function analyze(evidence: Evidence[], targetUser: string) {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const existing = groups.get(item.signalType) ?? [];
    existing.push(item);
    groups.set(item.signalType, existing);
  }

  return AnalysisSchema.parse({
    targetUser,
    repeatedProblems: [...groups.entries()].map(([signal, items]) => ({
      signal,
      evidenceIds: items.map(e => e.id),
    })),
    alternatives: evidence
      .filter(e => e.signalType === 'alternative' || e.signalType === 'commodity')
      .map(e => e.excerpt),
    complexitySummary:
      evidence.filter(e => e.signalType === 'feasibility').map(e => e.excerpt).join(' ') ||
      'Unknown: no feasibility evidence supplied.',
  });
}
