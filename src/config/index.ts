import { z } from 'zod';

export const SPEND_LIMIT = 0 as const;
export const RulesSchema = z.object({
  minEvidence: z.number().int().min(5).default(5),
  minDomains: z.number().int().min(2).default(2),
  minConfidence: z.number().min(0.5).max(1).default(0.65),
  validateScore: z.number().min(1).max(100).default(45),
  buildScore: z.number().min(1).max(100).default(75),
  targetSignals: z.number().int().positive().default(5),
  killAfterDays: z.number().int().positive().default(14),
  minVisits: z.number().int().positive().default(100),
  minSignups: z.number().int().nonnegative().default(3),
  maxExperimentDays: z.number().int().positive().default(30),
}).strict().refine(r => r.buildScore >= r.validateScore, 'buildScore must be at least validateScore')
  .refine(r => r.maxExperimentDays >= r.killAfterDays, 'maxExperimentDays must be at least killAfterDays');
export type Rules = z.infer<typeof RulesSchema>;
export const defaultRules = RulesSchema.parse({});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const base = z.object({
    PORT: z.coerce.number().int().min(1024).max(65535).default(4310),
    DATABASE_PATH: z.string().min(1).default('./data/mint.sqlite'),
    SPEND_LIMIT: z.coerce.number().refine(v => v === 0, 'MINT cannot spend money').default(0),
  }).parse(env);
  return { port: base.PORT, databasePath: base.DATABASE_PATH, spendLimit: SPEND_LIMIT,
    rules: RulesSchema.parse(env.MINT_RULES_JSON ? JSON.parse(env.MINT_RULES_JSON) : {}) };
}
