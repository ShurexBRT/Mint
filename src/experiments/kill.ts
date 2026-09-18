import type { Rules } from '../config/index.js';
export function evaluateKill(input: { createdAt: string; visits: number; signups: number; purchases: number; revenue: number }, rules: Rules, at = new Date()) {
  const ageDays = Math.max(0, (at.getTime() - new Date(input.createdAt).getTime()) / 86400000);
  const reasons: string[] = [];
  if (ageDays >= rules.killAfterDays && input.visits >= rules.minVisits && input.signups < rules.minSignups) reasons.push(`At least ${rules.minVisits} visits after ${rules.killAfterDays} days, but fewer than ${rules.minSignups} signups.`);
  if (ageDays >= rules.maxExperimentDays && input.purchases === 0) reasons.push(`No purchases after ${rules.maxExperimentDays} days. Stop rather than extend indefinitely.`);
  return { recommendation: reasons.length ? 'KILL' as const : 'CONTINUE' as const, reasons: reasons.length ? reasons : ['No kill threshold reached. Continue only within the time box.'], ageDays };
}
