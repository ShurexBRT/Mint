import { createHash } from 'node:crypto';
import type { ResearchClusterCandidate, ResearchSignalCandidate } from './types.js';

const STOP = new Set([
  'about','after','again','also','another','because','been','before','being','between','could','does','doing','from',
  'have','into','issue','just','manual','manually','more','need','only','other','really','should','some','than','that',
  'their','there','these','they','this','tool','using','very','want','with','would','workflow','workflows','your',
  'tedious','repetitive','annoying','painful','frustrating','time','consuming','automate','automation',
]);

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (signal: ResearchSignalCandidate) =>
  new Set(normalize(`${signal.title} ${signal.excerpt}`).split(' ').filter(word => word.length >= 4 && !STOP.has(word)));

function similarity(a: Set<string>, b: Set<string>) {
  const shared = [...a].filter(word => b.has(word)).length;
  if (shared < 2) return 0;
  return shared / new Set([...a, ...b]).size;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

export function clusterSignals(signals: ResearchSignalCandidate[]): ResearchClusterCandidate[] {
  const groups: ResearchSignalCandidate[][] = [];
  for (const signal of signals) {
    const tokens = words(signal);
    let best: { index: number; score: number } | null = null;
    groups.forEach((group, index) => {
      const groupTokens = new Set(group.flatMap(item => [...words(item)]));
      const score = similarity(tokens, groupTokens);
      if (score >= 0.16 && (!best || score > best.score)) best = { index, score };
    });
    if (best) groups[best.index].push(signal);
    else groups.push([signal]);
  }

  return groups
    .filter(group => group.length >= 3 && new Set(group.map(item => item.sourceIdentity)).size >= 3)
    .map(group => {
      const frequency = new Map<string, number>();
      for (const item of group) for (const word of words(item)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
      const keywords = [...frequency.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([word]) => word);
      if (keywords.length < 2) return null;

      const signalIds = group.map(item => item.id).sort();
      const label = keywords.slice(0, 3).join(' / ');
      return {
        id: `rc_${hash(signalIds.join('|'))}`,
        title: `Recurring friction: ${label}`,
        problemStatement: `${group.length} independent public signals repeatedly mention friction around ${keywords.slice(0, 4).join(', ')}. This is a research hypothesis, not proof of demand.`,
        targetUser: 'People reporting this problem in public developer and founder communities',
        signalIds,
        keywords,
        sourceCount: new Set(group.map(item => item.source)).size,
        domainCount: new Set(group.map(item => new URL(item.sourceUrl).hostname)).size,
      };
    })
    .filter((value): value is ResearchClusterCandidate => value !== null);
}
