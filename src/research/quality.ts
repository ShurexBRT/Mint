import type { ResearchClusterCandidate } from './types.js';

export interface ClusterQuality {
  signalCount: number;
  identityCount: number;
  sourceCount: number;
  domainCount: number;
  communityCount: number;
  painCount: number;
  buyingIntentCount: number;
  recurringCount: number;
  averageConfidence: number;
  score: number;
  autoPromoteEligible: boolean;
  blockers: string[];
}

type QualitySignal = {
  id: string;
  sourceIdentity: string;
  source: string;
  sourceUrl: string;
  community: string;
  signalType: string;
  confidence: number;
};

export function evaluateCluster(
  cluster: ResearchClusterCandidate,
  allSignals: QualitySignal[],
): ClusterQuality {
  const wanted = new Set(cluster.signalIds);
  const signals = allSignals.filter(signal => wanted.has(signal.id));
  const identityCount = new Set(signals.map(signal => signal.sourceIdentity)).size;
  const sourceCount = new Set(signals.map(signal => signal.source)).size;
  const domainCount = new Set(signals.map(signal => new URL(signal.sourceUrl).hostname)).size;
  const communityCount = new Set(signals.map(signal => signal.community.trim().toLowerCase())).size;
  const painCount = signals.filter(signal => ['pain', 'urgency'].includes(signal.signalType)).length;
  const buyingIntentCount = signals.filter(signal => signal.signalType === 'willingness_to_pay').length;
  const recurringCount = signals.filter(signal => signal.signalType === 'recurring').length;
  const averageConfidence = signals.length
    ? signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length
    : 0;

  const score = Math.round(Math.min(
    100,
    Math.min(30, identityCount * 6) +
      Math.min(15, sourceCount * 7.5) +
      Math.min(15, domainCount * 7.5) +
      Math.min(20, buyingIntentCount * 20) +
      Math.min(15, painCount * 3) +
      Math.min(5, recurringCount * 2.5),
  ));

  const blockers: string[] = [];
  if (signals.length < 5) blockers.push('Need at least 5 live signals.');
  if (identityCount < 5) blockers.push('Need at least 5 distinct public identities.');
  if (sourceCount < 2) blockers.push('Need at least 2 source types.');
  if (domainCount < 2) blockers.push('Need at least 2 independent domains.');
  if (communityCount < 2) blockers.push('Need at least 2 independent communities.');
  if (painCount < 2) blockers.push('Need at least 2 explicit pain/urgency signals.');
  if (buyingIntentCount < 1) blockers.push('Need at least 1 explicit willingness-to-pay signal.');
  if (averageConfidence < 0.72) blockers.push('Average signal confidence must be at least 72%.');
  if (score < 70) blockers.push('Cluster quality score must be at least 70.');

  return {
    signalCount: signals.length,
    identityCount,
    sourceCount,
    domainCount,
    communityCount,
    painCount,
    buyingIntentCount,
    recurringCount,
    averageConfidence,
    score,
    autoPromoteEligible: blockers.length === 0,
    blockers,
  };
}
