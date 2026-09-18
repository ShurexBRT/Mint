import { classifyPainSignal, excerpt } from '../classify.js';
import { fetchPublicJson } from '../http.js';
import type { ResearchCollector } from '../types.js';

type GitHubSearch = {
  items?: Array<{
    html_url?: string;
    title?: string;
    body?: string | null;
    created_at?: string;
    repository_url?: string;
    pull_request?: unknown;
    user?: { login?: string };
  }>;
};

function repoName(value = '') {
  const match = value.match(/\/repos\/([^/]+\/[^/]+)$/);
  return match?.[1] ?? 'github-issues';
}

export class GitHubIssueCollector implements ResearchCollector {
  readonly name = 'github' as const;

  async search(query: string, limit: number) {
    const q = encodeURIComponent(`${query} in:title,body is:issue is:open`);
    const data = await fetchPublicJson<GitHubSearch>(
      `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=${Math.min(limit, 10)}`,
    );

    return (data.items ?? []).flatMap((item) => {
      if (item.pull_request || !item.html_url || !item.title) return [];
      const body = item.body ?? '';
      const text = `${item.title}. ${body}`;
      const classification = classifyPainSignal(text);
      if (!classification) return [];
      return [{
        source: this.name,
        sourceUrl: item.html_url,
        sourceType: 'issue' as const,
        title: excerpt(item.title, 240),
        excerpt: excerpt(body || item.title),
        signalType: classification.signalType,
        sourceIdentity: `github:${item.user?.login ?? 'unknown'}`,
        community: repoName(item.repository_url),
        capturedAt: item.created_at ?? new Date().toISOString(),
        confidence: classification.confidence,
        query,
      }];
    });
  }
}
