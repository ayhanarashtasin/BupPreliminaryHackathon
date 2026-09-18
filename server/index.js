import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { runPipeline, PipelineError } from './pipeline.js';
import { llmConfig } from './llm.js';
import { warmUpSolver } from './optimizer.js';
import { initMongo, recordRun, listRuns } from './db.js';

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client');

/**
 * @param {{complete?: Function}} [deps] test-only injection of the model completion call.
 *   Production never passes it: the real provider in llm.js is the only interpretation path.
 */
export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.post('/optimize-energy', async (req, res, next) => {
    const started = Date.now();
    try {
      let config = null;
      if (!deps.complete) {
        try {
          config = llmConfig();
        } catch (e) {
          throw new PipelineError(500, 'language model provider is not configured', e.message);
        }
      }
      const result = await runPipeline(req.body, { config, complete: deps.complete });
      res.status(200).json(result);
      recordRun({
        scenario_id: result.scenario_id,
        operator_notes: req.body?.operator_notes,
        directive_interpretation: result.directive_interpretation,
        total_grid_kwh: result.total_grid_kwh,
        total_cost_bdt: result.total_cost_bdt,
        peak_grid_kwh: result.peak_grid_kwh,
        duration_ms: Date.now() - started,
        llm_model: config?.model ?? 'injected',
      });
    } catch (err) {
      next(err);
    }
  });

  // Demo-only routes for the React console. Not part of the judge contract.
  app.get('/api/sample-cases', (_req, res) => {
    const file = path.join(CLIENT_DIR, '..', 'BUP_CSE_FEST_2026_Preli_Public_Sample_Cases.json');
    if (!fs.existsSync(file)) return res.json({ cases: [] });
    const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json({ cases: pack.cases.map(({ id, label, input }) => ({ id, label, input })) });
  });

  // Run history from the optional Mongo store.
  app.get('/api/runs', async (_req, res) => res.json({ runs: await listRuns() }));

  app.use(express.static(CLIENT_DIR));
  app.use((_req, res) => res.status(404).json({ error: 'not found' }));

  // Controlled errors only: no stack traces, no provider bodies, no secrets.
  app.use((err, _req, res, _next) => {
    if (err instanceof PipelineError) {
      if (err.status >= 500) console.error(`[pipeline] ${err.message}: ${err.detail ?? ''}`);
      return res.status(err.status).json({ error: err.message });
    }
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'request body is not valid JSON' });
    }
    if (err?.type === 'entity.too.large') return res.status(400).json({ error: 'request body is too large' });
    console.error(`[unhandled] ${err?.message ?? err}`);
    return res.status(500).json({ error: 'internal error' });
  });

  return app;
}

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntrypoint) {
  const port = Number(process.env.PORT) || 8080;
  try {
    const cfg = llmConfig();
    console.log(`[llm] provider=${cfg.name} model=${cfg.model}`);
  } catch (err) {
    console.warn(`[llm] not configured: ${err.message} — /optimize-energy will return a controlled error until this is fixed`);
  }
  await warmUpSolver(); // load the WASM solver before announcing readiness
  initMongo();

  const server = createApp().listen(port, '0.0.0.0', () => console.log(`[gridwise] listening on 0.0.0.0:${port}`));
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
  process.on('unhandledRejection', (err) => console.error(`[unhandledRejection] ${err?.message ?? err}`));
}
