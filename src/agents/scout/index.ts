import { inspectEvidence } from '../../evidence/validate.js';
import type { Evidence } from '../../models/index.js';
import type { Rules } from '../../config/index.js';
// Scout accepts supplied evidence only. It never fetches URLs or invents sources.
export const scout = (evidence: Evidence[], rules: Rules) => inspectEvidence(evidence, rules);
