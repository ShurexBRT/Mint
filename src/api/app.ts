import express from 'express';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MintService } from '../engine/service.js';
import { seedDemo } from '../database/demo.js';
import { builderJobs, distributionExperiments } from '../database/schema.js';

export function createApp(service: MintService) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    // Loopback binding plus host/origin validation prevents browser DNS rebinding and cross-site writes.
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname)) {
      res.status(403).json({ error: 'Local requests only.' });
      return;
    }

    const origin = req.headers.origin;
    if (origin) {
      try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
          throw new Error();
        }
      } catch {
        res.status(403).json({ error: 'Cross-origin request rejected.' });
        return;
      }
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) {
      res.status(415).json({ error: 'JSON body required.' });
      return;
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', spendLimit: 0, mode: 'local-zero-cost', liveResearch: true }),
  );
  app.get('/api/overview', (_req, res) => res.json(service.overview()));
  app.get('/api/config', (_req, res) =>
    res.json({
      rules: service.rules,
      radar: service.radarConfig,
      spendLimit: 0,
      provider: 'deterministic-local',
      paidExecution: false,
    }),
  );

  app.get('/api/opportunities', (_req, res) => res.json(service.listOpportunities()));
  app.post('/api/opportunities', (req, res) => res.status(201).json(service.createOpportunity(req.body)));
  app.get('/api/opportunities/:id', (req, res) => res.json(service.detail(req.params.id)));
  app.post('/api/opportunities/:id/run', async (req, res) => res.json(await service.pipeline.run(req.params.id)));

  app.post('/api/demo', async (_req, res) => res.json({ ids: await seedDemo(service) }));

  app.get('/api/radar/signals', (_req, res) => res.json(service.listResearchSignals()));
  app.get('/api/radar/clusters', (_req, res) => res.json(service.listResearchClusters()));
  app.get('/api/radar/runs', (_req, res) => res.json(service.listRadarRuns()));
  app.post('/api/radar/run', async (req, res) => res.json(await service.runRadar(req.body)));
  app.post('/api/radar/hunt', async (req, res) => res.json(await service.runHunter(req.body)));
  app.post('/api/radar/clusters/:id/promote', async (req, res) =>
    res.status(201).json(await service.promoteResearchCluster(req.params.id)),
  );

  app.get('/api/ledger', (_req, res) => res.json(service.listLedger()));
  app.get('/api/experiments', (_req, res) => res.json(service.listExperiments()));
  app.post('/api/experiments', (req, res) => res.status(201).json(service.createExperiment(req.body)));
  app.post('/api/metrics', (req, res) => res.status(201).json(service.addMetric(req.body)));
  app.post('/api/experiments/:id/evaluate', (req, res) => {
    const input = z.object({ apply: z.boolean().default(false) }).strict().parse(req.body);
    res.json(service.evaluateExperiment(req.params.id, input.apply));
  });
  app.post('/api/authority', (req, res) => res.json(service.requestAction(req.body)));

  app.get('/api/distribution', (_req, res) =>
    res.json(service.db.select().from(distributionExperiments).all()),
  );
  app.post('/api/distribution', (req, res) =>
    res.status(201).json(service.createDistribution(req.body)),
  );

  app.get('/api/builder-jobs', (_req, res) =>
    res.json(service.db.select().from(builderJobs).all()),
  );
  app.post('/api/builder-jobs', (req, res) =>
    res.status(201).json(service.createBuilderJob(req.body)),
  );

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

  const ui = resolve('dist/ui');
  if (existsSync(ui)) {
    app.use(express.static(ui));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(ui, 'index.html')));
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    void _next;
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', issues: error.issues });
      return;
    }
    const message = error instanceof Error ? error.message : 'Request failed';
    res.status(message.includes('not found') ? 404 : message.includes('cooldown') ? 429 : 400).json({ error: message });
  });

  return app;
}
