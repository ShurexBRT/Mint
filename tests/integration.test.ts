import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { eq } from 'drizzle-orm';
import { openDatabase } from '../src/database/index';
import { MintService } from '../src/engine/service';
import { defaultRules } from '../src/config/index';
import { seedDemo, demoInputs } from '../src/database/demo';
import { createApp } from '../src/api/app';
import { experiments, agentRuns, costEntries } from '../src/database/schema';
import { Pipeline } from '../src/engine/pipeline';
import { DeterministicLocalProvider } from '../src/providers/index';
let connection: ReturnType<typeof openDatabase>, service: MintService, server: Server | undefined;
beforeEach(() => { connection = openDatabase(); service = new MintService(connection.db, defaultRules); });
afterEach(async () => { if (server) { await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } connection.sqlite.close(); });
describe('local pipeline persistence', () => {
  it('runs demo into VALIDATE, RESEARCH_MORE, KILL with inputs/outputs, cost entries, audit events', async () => {
    const ids = await seedDemo(service); expect(service.listOpportunities().map(o => o.status).sort()).toEqual(['KILL', 'RESEARCH_MORE', 'VALIDATE']);
    expect(connection.db.select().from(agentRuns).all()).toHaveLength(15); expect(connection.db.select().from(costEntries).all().every(c => c.cost === 0)).toBe(true); expect(service.listLedger()).toHaveLength(21);
    expect(service.detail(ids[0]).runs.map(r => r.agent).sort()).toEqual(['Analyst', 'Director', 'Palermo', 'Scorer', 'Scout']); expect(service.detail(ids[0]).runs.every(r => r.status === 'SUCCESS' && r.input && r.output && r.duration >= 0)).toBe(true);
    await seedDemo(service); expect(service.listOpportunities()).toHaveLength(3); expect(service.listLedger()).toHaveLength(21);
  });
  it('keeps experiments internal, demo revenue excluded, and metric events idempotent', async () => {
    const ids = await seedDemo(service); const e = service.createExperiment({ opportunityId: ids[0], hypothesis: 'Three signups within fourteen days from one hundred visits.' });
    const batch = { experimentId: e.id, eventId: 'batch-1', visits: 100, signups: 5, purchases: 1, revenue: 25, synthetic: true };
    service.addMetric(batch); expect(() => service.addMetric(batch)).toThrow('Duplicate'); expect(service.listExperiments()[0].conversion).toBe(.05); expect(service.overview()).toMatchObject({ revenue: 0, externalSpend: 0, aiSpend: 0, net: 0 });
    expect(service.createDistribution({ experimentId: e.id, channel: 'Opt-in research group', message: 'AI-assisted synthetic research draft, not sent.' }).status).toBe('REQUIRES_OWNER_APPROVAL');
    expect(() => service.createExperiment({ opportunityId: ids[1], hypothesis: 'This opportunity has not met the validation criteria.' })).toThrow(); expect(() => service.createExperiment({ opportunityId: ids[0], hypothesis: 'A duplicate active experiment must be rejected.' })).toThrow('already exists');
  });
  it('applies measured kill rules and rejects metrics after termination', async () => {
    const ids = await seedDemo(service); const e = service.createExperiment({ opportunityId: ids[0], hypothesis: 'Three signups within fourteen days from one hundred visits.' });
    connection.db.update(experiments).set({ createdAt: '2020-01-01T00:00:00.000Z' }).where(eq(experiments.id, e.id)).run(); expect(service.evaluateExperiment(e.id, true).recommendation).toBe('KILL'); expect(service.overview().killedExperiments).toBe(1);
    expect(() => service.addMetric({ experimentId: e.id, eventId: 'late-event', visits: 1, signups: 0, purchases: 0, revenue: 0, synthetic: true })).toThrow('Active experiment not found');
  });
  it('records provider failures and releases the opportunity lock', async () => {
    const o = service.createOpportunity(demoInputs[0]);
    class Failing extends DeterministicLocalProvider { override async generateStructured<T>(): Promise<{ output: T; estimatedTokens: number; estimatedCost: 0 }> { throw new Error('Injected failure'); } }
    const pipeline = new Pipeline(connection.db, defaultRules, new Failing()); await expect(pipeline.run(o.id)).rejects.toThrow('Injected failure'); await expect(pipeline.run(o.id)).rejects.toThrow('Injected failure'); expect(service.detail(o.id).status).toBe('NEW'); expect(service.detail(o.id).runs).toHaveLength(2); expect(service.detail(o.id).runs.every(r => r.error === 'Injected failure')).toBe(true);
  });
  it('enforces zero cost, no BUILD, and append-only ledger at the database layer', async () => {
    const ids = await seedDemo(service); expect(() => connection.sqlite.prepare('UPDATE cost_entries SET cost = 1').run()).toThrow(); expect(() => connection.sqlite.prepare("UPDATE opportunities SET status = 'BUILD' WHERE id = ?").run(ids[0])).toThrow('synthetic evidence'); expect(() => connection.sqlite.prepare('DELETE FROM ledger').run()).toThrow('append-only'); expect(() => connection.sqlite.prepare("UPDATE ledger SET agent = 'forged'").run()).toThrow('append-only');
    const e = service.createExperiment({ opportunityId: ids[0], hypothesis: 'A zero cost validation hypothesis.' }); service.addMetric({ experimentId: e.id, eventId: 'batch-1', visits: 1, signups: 1, purchases: 1, revenue: 1, synthetic: true }); expect(() => connection.sqlite.prepare('UPDATE metrics SET verified = 1').run()).toThrow();
  });
  it('reopens persisted data and applies migrations idempotently', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mint-test-')); const path = join(dir, 'mint.sqlite');
    try { const first = openDatabase(path); new MintService(first.db, defaultRules).createOpportunity(demoInputs[1]); first.sqlite.close(); const second = openDatabase(path); expect(new MintService(second.db, defaultRules).listOpportunities()).toHaveLength(1); expect(second.sqlite.pragma('user_version', { simple: true })).toBe(3); second.sqlite.close(); } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
async function call(path: string, method = 'GET', body?: unknown, extraHeaders: Record<string, string> = {}) {
  if (!server) { server = createApp(service).listen(0, '127.0.0.1'); await once(server, 'listening'); }
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local address');
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: address.port, path: `/api${path}`, method, headers: { 'Content-Type': 'application/json', ...extraHeaders } }, res => { let data = ''; res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(data) })); }); req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
describe('REST boundary (loopback only, offline)', () => {
  it('starts with no key, serves local health, rejects invalid input and unknown routes', async () => { expect((await call('/health')).body).toMatchObject({ status: 'ok', spendLimit: 0 }); expect((await call('/opportunities', 'POST', { title: 'bad' })).status).toBe(400); expect((await call('/opportunities/missing')).status).toBe(404); expect((await call('/unknown')).status).toBe(404); });
  it('blocks hostile origins, rebinding hosts, non-JSON writes, and approval spoofing', async () => {
    expect((await call('/demo', 'POST', {}, { Origin: 'https://evil.example' })).status).toBe(403); expect((await call('/health', 'GET', undefined, { Host: 'evil.example' })).status).toBe(403); expect((await call('/demo', 'POST', {}, { 'Content-Type': 'text/plain' })).status).toBe(415); expect((await call('/authority', 'POST', { action: 'paid_api', approved: true })).status).toBe(400); expect((await call('/authority', 'POST', { action: 'paid_api' })).body).toMatchObject({ executable: false, status: 'REQUIRES_OWNER_APPROVAL' });
  });
  it('runs a supplied fixture through all five agents via HTTP', async () => { const created = await call('/opportunities', 'POST', demoInputs[0]); expect(created.status).toBe(201); expect((await call(`/opportunities/${created.body.id}/run`, 'POST', {})).body.decision).toBe('VALIDATE'); expect((await call('/overview')).body.validationCandidates).toBe(1); });
});
