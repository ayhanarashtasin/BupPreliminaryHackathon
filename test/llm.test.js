import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson, interpretNotes, llmConfig, attemptTimeout, InterpretationError } from '../server/llm.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../server/prompt.js';
import { scenario, directive, noOp } from './fixtures.js';

const battery = scenario().battery;
const notes = ['Solar drops to a fifth from 1 PM to 3 PM.', 'Unrelated announcement.'];
const good = JSON.stringify({ directive_interpretation: [directive('solar_reduction', { hours: [13, 14], factor: 0.2 }, 0), noOp(1)] });

test('parses fenced and prose-wrapped model output', () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseModelJson('Sure! {"a":1} hope that helps'), { a: 1 });
  assert.throws(() => parseModelJson('no object here'), InterpretationError);
  assert.throws(() => parseModelJson('{broken'), InterpretationError);
});

test('the prompt states the officially defined semantics', () => {
  assert.match(SYSTEM_PROMPT, /END HOUR EXCLUDED/);
  assert.match(SYSTEM_PROMPT, /80% reduction->0\.2/);
  for (const t of ['solar_reduction', 'minimum_battery_reserve', 'no_charge_window', 'no_discharge_window', 'max_grid_window', 'no_op']) {
    assert.ok(SYSTEM_PROMPT.includes(t));
  }
  const user = buildUserPrompt(notes, battery);
  assert.match(user, /capacity_kwh=200/); // needed to convert "50% of the battery" into kWh
  assert.match(SYSTEM_PROMPT, /1 PM to 3 PM->\[13,14\]/);
  assert.match(user, /^0: Solar drops/m);
  assert.match(user, /^1: Unrelated/m);
});

test('a rejected interpretation is retried once, with the validator message as feedback', async () => {
  const transcripts = [];
  let calls = 0;
  const complete = async (messages) => {
    transcripts.push(messages.map((m) => m.role).join('>'));
    return ++calls === 1
      ? JSON.stringify({ directive_interpretation: [directive('solar_reduction', { hours: [14, 13], factor: 0.2 }, 0), noOp(1)] }) // unsorted hours
      : good;
  };
  const directives = await interpretNotes({ notes, battery, config: { maxAttempts: 2 }, complete });
  assert.equal(calls, 2);
  assert.equal(transcripts[1], 'system>user>assistant>user'); // the rejection was fed back
  assert.deepEqual(directives[0].structured_adjustment.hours, [13, 14]);
});

test('retries are bounded and a still-invalid interpretation fails instead of being guessed', async () => {
  let calls = 0;
  const complete = async () => {
    calls++;
    return JSON.stringify({ directive_interpretation: [directive('solar_reduction', { hours: [13], factor: 3 }, 0), noOp(1)] });
  };
  await assert.rejects(interpretNotes({ notes, battery, config: { maxAttempts: 2 }, complete }), InterpretationError);
  assert.equal(calls, 2);
});

test('an injected model completion drives the real guardrailed path', async () => {
  const directives = await interpretNotes({ notes, battery, config: {}, complete: async () => good });
  assert.equal(directives.length, 2);
  assert.equal(directives[0].directive_type, 'solar_reduction');
  assert.deepEqual(directives[0].structured_adjustment, { hours: [13, 14], factor: 0.2 });
  assert.equal(directives[1].applies, false);
});

test('a failed interpretation throws instead of silently becoming no_op', async () => {
  await assert.rejects(
    interpretNotes({ notes, battery, config: {}, complete: async () => JSON.stringify({ directive_interpretation: [directive('teleport', { hours: [1] }, 0), noOp(1)] }) }),
    InterpretationError,
  );
  await assert.rejects(interpretNotes({ notes, battery, config: {}, complete: async () => 'garbage' }), InterpretationError);
});

test('no provider call may outlive the interpretation budget', () => {
  const config = { timeoutMs: 9000 };
  const now = 1_000_000;
  // Plenty of budget left: the per-attempt timeout governs.
  assert.equal(attemptTimeout(config, now + 25000, now), 9000);
  // Budget nearly gone: the attempt is clamped, never the full timeout.
  assert.equal(attemptTimeout(config, now + 1200, now), 1200);
  // Budget spent: chat() refuses to start another call.
  assert.ok(attemptTimeout(config, now - 1, now) <= 0);
});

test('the retry loop stops once the budget is spent instead of starting another attempt', async () => {
  let calls = 0;
  const slow = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 120));
    return 'not json';
  };
  const started = Date.now();
  await assert.rejects(interpretNotes({ notes, battery, config: { maxAttempts: 5, budgetMs: 300 }, complete: slow }), InterpretationError);
  assert.ok(Date.now() - started < 1500, 'gave up well inside the budget');
  assert.ok(calls < 5, `stopped early, made ${calls} attempts`);
});

test('provider configuration is validated and never hard-coded', () => {
  assert.throws(() => llmConfig({ LLM_PROVIDER: 'groq' }), /GROQ_API_KEY/);
  assert.throws(() => llmConfig({ LLM_PROVIDER: 'nope', LLM_API_KEY: 'x' }), /unsupported LLM_PROVIDER/);
  assert.throws(() => llmConfig({ LLM_PROVIDER: 'openai_compatible', LLM_API_KEY: 'x', LLM_MODEL: 'm' }), /LLM_BASE_URL/);
  const cfg = llmConfig({ GROQ_API_KEY: 'k', GROQ_MODEL: 'llama-3.3-70b-versatile' });
  assert.equal(cfg.name, 'groq');
  assert.equal(cfg.model, 'llama-3.3-70b-versatile');
  assert.equal(cfg.baseUrl, 'https://api.groq.com/openai/v1');
  assert.equal(cfg.maxAttempts, 2);
});
