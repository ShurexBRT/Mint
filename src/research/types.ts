import type { SignalType } from '../models/index.js';

export type ResearchSource = 'github' | 'hackernews';

export interface ResearchSignalCandidate {
  id: string;
  fingerprint: string;
  source: ResearchSource;
  sourceUrl: string;
  sourceType: 'issue' | 'forum';
  title: string;
  excerpt: string;
  signalType: SignalType;
  sourceIdentity: string;
  community: string;
  capturedAt: string;
  confidence: number;
  query: string;
}

export interface ResearchClusterCandidate {
  id: string;
  title: string;
  problemStatement: string;
  targetUser: string;
  signalIds: string[];
  keywords: string[];
  sourceCount: number;
  domainCount: number;
}

export interface ResearchCollector {
  readonly name: ResearchSource;
  search(query: string, limit: number): Promise<Omit<ResearchSignalCandidate, 'id' | 'fingerprint'>[]>;
}

export interface RadarResult {
  signals: ResearchSignalCandidate[];
  clusters: ResearchClusterCandidate[];
  errors: string[];
  requestCount: number;
}
