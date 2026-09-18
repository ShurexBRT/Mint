import { classifyPainSignal, excerpt, stripHtml } from '../classify.js';
import { fetchPublicJson } from '../http.js';
import type { ResearchCollector } from '../types.js';

type HNSearch = {
  hits?: Array<{
    objectID?: string;
    author?: string;
    comment_text?: string | null;
    story_title?: string | null;
    created_at?: string;
  }>;
};

export class HackerNewsCollector implements ResearchCollector {
  readonly name = 'hackernews' as const;

  async search(query: string, limit: number) {
    const q = encodeURIComponent(query);
    const data = await fetchPublicJson<HNSearch>(
      `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=comment&hitsPerPage=${Math.min(limit, 10)}`,
    );

    return (data.hits ?? []).flatMap((item) => {
      if (!item.objectID || !item.comment_text) return [];
      const clean = stripHtml(item.comment_text);
      const classification = classifyPainSignal(clean);
      if (!classification) return [];
      return [{
        source: this.name,
        sourceUrl: `https://news.ycombinator.com/item?id=${encodeURIComponent(item.objectID)}`,
        sourceType: 'forum' as const,
        title: excerpt(item.story_title ?? 'Hacker News discussion', 240),
        excerpt: excerpt(clean),
        signalType: classification.signalType,
        sourceIdentity: `hn:${item.author ?? 'unknown'}`,
        community: item.story_title ? `HN: ${excerpt(item.story_title, 180)}` : 'Hacker News',
        capturedAt: item.created_at ?? new Date().toISOString(),
        confidence: classification.confidence,
        query,
      }];
    });
  }
}
