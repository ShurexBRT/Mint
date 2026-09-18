import { z } from 'zod';

export const SignalSchema = z.enum([
  'pain',
  'urgency',
  'willingness_to_pay',
  'alternative',
  'distribution',
  'recurring',
  'feasibility',
  'commodity',
  'legal_risk',
  'security_risk',
  'privacy_risk',
  'platform_risk',
]);
export type SignalType = z.infer<typeof SignalSchema>;

const EvidenceCoreSchema = z.object({
  sourceUrl: z.url().refine(v => ['https:', 'http:'].includes(new URL(v).protocol), 'Public HTTP(S) URL required'),
  sourceType: z.enum(['forum', 'review', 'issue', 'interview', 'research']),
  excerpt: z.string().trim().min(12).max(5000),
  signalType: SignalSchema,
  sourceIdentity: z.string().trim().min(2).max(200),
  community: z.string().trim().min(2).max(240),
  capturedAt: z.iso.datetime(),
  confidence: z.number().min(0).max(1),
  complexityEstimate: z.number().int().min(1).max(5).optional(),
}).strict();

export const EvidenceInputSchema = EvidenceCoreSchema.extend({ synthetic: z.literal(true) });
export const LiveEvidenceInputSchema = EvidenceCoreSchema.extend({ synthetic: z.literal(false) });
export const AnyEvidenceInputSchema = z.union([EvidenceInputSchema, LiveEvidenceInputSchema]);

export type EvidenceInput = z.infer<typeof EvidenceInputSchema>;
export type LiveEvidenceInput = z.infer<typeof LiveEvidenceInputSchema>;
export type Evidence = Omit<z.infer<typeof AnyEvidenceInputSchema>, 'complexityEstimate'> & {
  id: string;
  opportunityId: string;
  complexityEstimate?: number | null;
};

export const OpportunityInputSchema = z.object({
  title: z.string().trim().min(3).max(140),
  problemStatement: z.string().trim().min(12).max(3000),
  targetUser: z.string().trim().min(3).max(300),
  evidence: z.array(EvidenceInputSchema).max(100),
}).strict();
export type OpportunityInput = z.infer<typeof OpportunityInputSchema>;

export const DecisionKindSchema = z.enum(['RESEARCH_MORE', 'VALIDATE', 'BUILD', 'KILL']);
export type DecisionKind = z.infer<typeof DecisionKindSchema>;

export const ScoreSchema = z.object({
  value: z.number().min(0).max(100),
  evidenceIds: z.array(z.string()),
  reason: z.string(),
});
export const ScoresSchema = z.object({
  demand: ScoreSchema,
  urgency: ScoreSchema,
  willingnessToPay: ScoreSchema,
  competition: ScoreSchema,
  buildComplexity: ScoreSchema,
  distribution: ScoreSchema,
  recurring: ScoreSchema,
  total: z.number().min(0).max(100),
});
export type Scores = z.infer<typeof ScoresSchema>;

export const PalermoSchema = z.object({
  verdict: z.enum(['PASS', 'CAUTION', 'VETO']),
  critical: z.boolean(),
  reasons: z.array(z.string()),
  evidenceIds: z.array(z.string()),
});
export type PalermoResult = z.infer<typeof PalermoSchema>;

export const DirectorSchema = z.object({
  decision: DecisionKindSchema,
  reasons: z.array(z.string()),
  blockers: z.array(z.string()),
  evidenceIds: z.array(z.string()),
});
export type DirectorResult = z.infer<typeof DirectorSchema>;

export const AnalysisSchema = z.object({
  targetUser: z.string(),
  repeatedProblems: z.array(z.object({ signal: z.string(), evidenceIds: z.array(z.string()) })),
  alternatives: z.array(z.string()),
  complexitySummary: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

export type Opportunity = {
  id: string;
  title: string;
  problemStatement: string;
  targetUser: string;
  status: DecisionKind | 'NEW';
  synthetic: boolean;
  evidenceMode: 'SYNTHETIC' | 'LIVE' | 'MIXED';
  demandScore: number;
  urgencyScore: number;
  willingnessToPayScore: number;
  competitionScore: number;
  buildComplexityScore: number;
  distributionScore: number;
  recurringScore: number;
  totalScore: number;
  palermoVerdict: string;
  createdAt: string;
  updatedAt: string;
};

export const ExperimentInputSchema = z.object({
  opportunityId: z.string().min(1),
  hypothesis: z.string().trim().min(12).max(2000),
}).strict();

export const MetricInputSchema = z.object({
  experimentId: z.string().min(1),
  eventId: z.string().trim().min(3).max(200),
  visits: z.number().int().nonnegative(),
  signups: z.number().int().nonnegative(),
  purchases: z.number().int().nonnegative(),
  revenue: z.number().nonnegative().finite(),
  synthetic: z.literal(true),
}).strict()
  .refine(m => m.signups <= m.visits && m.purchases <= m.signups, 'Expected purchases ≤ signups ≤ visits')
  .refine(m => m.revenue === 0 || m.purchases > 0, 'Revenue requires purchases');

export const CostEntryInputSchema = z.object({
  cost: z.literal(0).default(0),
  category: z.enum(['AI_API', 'EXTERNAL']),
  description: z.string().min(1),
}).strict();
