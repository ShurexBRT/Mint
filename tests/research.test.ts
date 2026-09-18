import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../src/database/index';
import { defaultRules, RadarConfigSchema } from '../src/config/index';
import { MintService } from '../src/engine/service';
import { ResearchRadar } from '../src/research/radar';
import { classifyPainSignal } from '../src/research/classify';
import type { ResearchCollector } from '../src/research/types';

class FakeGitHubCollector implements ResearchCollector {
  readonly name = 'github' as const;
  async search(query: string) {
    return [
      {
        source: this.name,
        sourceUrl: 'https://github.com/acme/exporter/issues/1',
        sourceType: 'issue' as const,
        title: 'CSV invoice export needs manual cleanup',
        excerpt: 'Our CSV invoice export needs manual cleanup before accounting import every month.',
        signalType: 'pain' as const,
        sourceIdentity: 'github:user-a',
        community: 'acme/exporter',
        capturedAt: '2026-09-01T10:00:00.000Z',
        confidence: 0.86,
        query,
      },
      {
        source: this.name,
        sourceUrl: 'https://github.com/other/csv-tool/issues/2',
        sourceType: 'issue' as const,
        title: 'CSV invoice export costs us time',
        excerpt: 'We would pay for a reliable CSV invoice export that matches the accounting import.',
        signalType: 'willingness_to_pay' as const,
        sourceIdentity: 'github:user-b',
        community: 'other/csv-tool',
        capturedAt: '2026-09-02T10:00:00.000Z',
        confidence: 0.9,
        query,
      },
    ];
  }
}

class FakeHackerNewsCollector implements ResearchCollector {
  readonly name = 'hackernews' as const;
  async search(query: string) {
    return [
      {
        source: this.name,
        sourceUrl: 'https://news.ycombinator.com/item?id=1001',
        sourceType: 'forum' as const,
        title: 'CSV invoice export for accounting',
        excerpt: 'Every month I manually reshape the CSV invoice export before accounting import.',
        signalType: 'pain' as const,
        sourceIdentity: 'hn:user-c',
        community: 'HN: accounting exports',
        capturedAt: '2026-09-03T10:00:00.000Z',
        confidence: 0.84,
        query,
      },
      {
        source: this.name,
        sourceUrl: 'https://news.ycombinator.com/item?id=1002',
        sourceType: 'forum' as const,
        title: 'CSV invoice export workaround',
        excerpt: 'The CSV invoice export workaround is repetitive and breaks our accounting import.',
        signalType: 'recurring' as const,
        sourceIdentity: 'hn:user-d',
        community: 'HN: accounting workflow',
        capturedAt: '2026-09-04T10:00:00.000Z',
        confidence: 0.8,
        query,
      },
    ];
  }
}

describe('Research Radar', () => {
  let connection: ReturnType<typeof openDatabase>;

  beforeEach(() => {
    connection = openDatabase();
  });

  afterEach(() => {
    connection.sqlite.close();
  });

  it('classifies explicit pain and buying intent without an LLM', () => {
    expect(classifyPainSignal('I manually fix this tedious export every week')?.signalType).toBe('pain');
    expect(classifyPainSignal('I would pay for a reliable tool')?.signalType).toBe('willingness_to_pay');
    expect(classifyPainSignal('Everything is fine here')).toBeNull();
  });

  it('clusters repeated live signals, stores them at zero cost, and promotes them into the pipeline', async () => {
    const radar = new ResearchRadar([new FakeGitHubCollector(), new FakeHackerNewsCollector()]);
    const service = new MintService(
      connection.db,
      defaultRules,
      radar,
      RadarConfigSchema.parse({ cooldownMinutes: 5, maxQueries: 4, perSourceLimit: 5 }),
    );

    const result = await service.runRadar({ queries: ['csv invoice export'], perSourceLimit: 5 });
    expect(result.spend).toBe(0);
    expect(result.signalCount).toBe(4);
    expect(result.clusterCount).toBeGreaterThanOrEqual(1);
    expect(service.overview()).toMatchObject({ externalSpend: 0, aiSpend: 0, radarSignals: 4 });

    const cluster = service.listResearchClusters()[0];
    const promoted = await service.promoteResearchCluster(cluster.id);
    expect(promoted.evidenceMode).toBe('LIVE');
    expect(promoted.evidence.every(item => item.synthetic === false)).toBe(true);
    expect(promoted.status).toBe('RESEARCH_MORE');
    expect(service.overview().liveEvidenceCount).toBe(4);
  });

  it('enforces a radar cooldown instead of hammering public endpoints', async () => {
    const radar = new ResearchRadar([new FakeGitHubCollector(), new FakeHackerNewsCollector()]);
    const service = new MintService(connection.db, defaultRules, radar);
    await service.runRadar({ queries: ['csv invoice export'], perSourceLimit: 2 });
    await expect(service.runRadar({ queries: ['csv invoice export'], perSourceLimit: 2 })).rejects.toThrow('cooldown');
  });
});
