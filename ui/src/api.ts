import type { MintService } from '../../src/engine/service';

export type Overview = ReturnType<MintService['overview']>;
export type Opportunity = ReturnType<MintService['listOpportunities']>[number];
export type Detail = ReturnType<MintService['detail']>;
export type Experiment = ReturnType<MintService['listExperiments']>[number];
export type LedgerEntry = ReturnType<MintService['listLedger']>[number];
export type ResearchCluster = ReturnType<MintService['listResearchClusters']>[number];
export type ResearchSignal = ReturnType<MintService['listResearchSignals']>[number];
export type RadarRun = ReturnType<MintService['listRadarRuns']>[number];

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      result.issues
        ? `${result.error}: ${result.issues.map((i: { path: string[]; message: string }) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
        : result.error || 'Request failed',
    );
  }
  return result;
}

export const euro = (value: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);

export const label = (value: string) =>
  value.toLowerCase().replaceAll('_', ' ').replace(/^./, s => s.toUpperCase());
