import { PalermoSchema, type Evidence } from '../../models/index.js';
export function challenge(all: Evidence[], accepted: Evidence[], rejected: { id: string; reason: string }[]) {
  // Critical flags are never removed by confidence filtering or deduplication.
  const risks = all.filter(e => ['legal_risk', 'security_risk', 'privacy_risk', 'platform_risk'].includes(e.signalType));
  const commodities = accepted.filter(e => e.signalType === 'commodity');
  const buying = accepted.some(e => e.signalType === 'willingness_to_pay');
  const duplicates = rejected.filter(e => e.reason.startsWith('Duplicate'));
  const reasons: string[] = [];
  if (risks.length) reasons.push('Critical legal, security, privacy, or platform risk requires resolution.');
  if (commodities.length) reasons.push('Commodity alternative exists; differentiation is unproven.');
  if (!buying) reasons.push('No independent evidence of willingness to pay.');
  if (duplicates.length) reasons.push(`${duplicates.length} duplicate evidence item(s) excluded. Source identity is asserted, not externally verified.`);
  if (!reasons.length) reasons.push('No rule-based veto found. This is not proof of demand or a legal review.');
  return PalermoSchema.parse({ verdict: risks.length || commodities.length ? 'VETO' : !buying || duplicates.length ? 'CAUTION' : 'PASS', critical: risks.length > 0, reasons, evidenceIds: [...risks, ...commodities].map(e => e.id) });
}
