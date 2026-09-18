import { createHash } from 'node:crypto';
import { clusterSignals } from './cluster.js';
import { GitHubIssueCollector } from './collectors/github.js';
import { HackerNewsCollector } from './collectors/hackernews.js';
import type { RadarResult, ResearchCollector, ResearchSignalCandidate } from './types.js';

const DEFAULT_QUERIES = [
  'manual spreadsheet',
  'tedious export',
  'repetitive reporting',
  'would pay tool',
];

function stableId(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function fingerprint(sourceUrl: string, sourceIdentity: string) {
  return createHash('sha256')
    .update(`${sourceUrl.toLowerCase()}|${sourceIdentity.toLowerCase()}`)
    .digest('hex');
}

export class ResearchRadar {
  constructor(readonly collectors: ResearchCollector[] = [new GitHubIssueCollector(), new HackerNewsCollector()]) {}

  async run(rawQueries: string[] = DEFAULT_QUERIES, perSourceLimit = 5): Promise<RadarResult> {
    const queries = [...new Set(rawQueries.map(q => q.trim()).filter(Boolean))].slice(0, 4);
    const limit = Math.max(1, Math.min(5, perSourceLimit));
    const errors: string[] = [];
    const collected: ResearchSignalCandidate[] = [];
    let requestCount = 0;

    for (const query of queries) {
      for (const collector of this.collectors) {
        requestCount += 1;
        try {
          const hits = await collector.search(query, limit);
          for (const hit of hits) {
            const fp = fingerprint(hit.sourceUrl, hit.sourceIdentity);
            collected.push({ ...hit, id: `rs_${stableId(fp)}`, fingerprint: fp });
          }
        } catch (error) {
          errors.push(`${collector.name} / "${query}": ${error instanceof Error ? error.message : 'collector failed'}`);
        }
      }
    }

    const unique = [...new Map(collected.map(item => [item.fingerprint, item])).values()];
    return { signals: unique, clusters: clusterSignals(unique), errors, requestCount };
  }
}

export { DEFAULT_QUERIES };
