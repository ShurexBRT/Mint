import { getDomain } from 'tldts';
import type { Evidence } from '../models/index.js';
import type { Rules } from '../config/index.js';

export function canonicalUrl(value: string) {
  const u = new URL(value);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (/^(utm_|ref$|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
}
export function sourceDomain(value: string) { const host = new URL(value).hostname; return getDomain(host, { allowPrivateDomains: true }) ?? host; }
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function inspectEvidence(evidence: Evidence[], rules: Rules, at = new Date()) {
  const urls = new Set<string>(), identities = new Set<string>(), excerpts = new Set<string>();
  const accepted: Evidence[] = [], rejected: { id: string; reason: string }[] = [];
  for (const e of evidence) {
    const url = canonicalUrl(e.sourceUrl), identity = normalize(e.sourceIdentity), excerpt = normalize(e.excerpt);
    const host = new URL(e.sourceUrl).hostname;
    let reason = '';
    if (e.confidence < rules.minConfidence) reason = 'Confidence below threshold';
    else if (new Date(e.capturedAt).getTime() > at.getTime()) reason = 'Capture timestamp is in the future';
    else if (/^(localhost|127\.|0\.|10\.|192\.168\.|\[|169\.254\.)/i.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || !getDomain(host)) reason = 'Not a public source domain';
    else if (urls.has(url) || identities.has(identity) || excerpts.has(excerpt)) reason = 'Duplicate URL, source identity, or excerpt';
    if (reason) { rejected.push({ id: e.id, reason }); continue; }
    urls.add(url); identities.add(identity); excerpts.add(excerpt); accepted.push(e);
  }
  return { accepted, rejected, domains: [...new Set(accepted.map(e => sourceDomain(e.sourceUrl)))], communities: [...new Set(accepted.map(e => normalize(e.community)))] };
}
