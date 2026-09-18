// LLM provider abstraction + the interpretation path. The model genuinely produces the
// structured directives; guardrails then decide whether they may reach the optimizer.

import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { validateInterpretation } from './guardrails.js';

export class InterpretationError extends Error {}

// Every supported provider speaks the OpenAI chat-completions dialect, so one client covers them all.
const PROVIDERS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', keyEnv: 'GROQ_API_KEY', modelEnv: 'GROQ_MODEL', defaultModel: 'openai/gpt-oss-120b' },
  openai: { baseUrl: 'https://api.openai.com/v1', keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL', defaultModel: 'gpt-4o-mini' },
  // Anything else exposing /v1/chat/completions: Together, OpenRouter, vLLM, Ollama, ...
  openai_compatible: { baseUrl: null, keyEnv: 'LLM_API_KEY', modelEnv: 'LLM_MODEL', defaultModel: null },
};

export function llmConfig(env = process.env) {
  const name = (env.LLM_PROVIDER || 'groq').toLowerCase();
  const p = PROVIDERS[name];
  if (!p) throw new Error(`unsupported LLM_PROVIDER "${name}"`);
  const baseUrl = env.LLM_BASE_URL || p.baseUrl;
  const apiKey = env[p.keyEnv] || env.LLM_API_KEY;
  const model = env[p.modelEnv] || env.LLM_MODEL || p.defaultModel;
  if (!baseUrl) throw new Error(`LLM_BASE_URL is required for LLM_PROVIDER=${name}`);
  if (!model) throw new Error(`${p.modelEnv} (or LLM_MODEL) is required for LLM_PROVIDER=${name}`);
  if (!apiKey) throw new Error(`${p.keyEnv} is required for LLM_PROVIDER=${name}`);
  return {
    name,
    model,
    baseUrl,
    apiKey,
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 9000,
    maxAttempts: Math.max(1, Number(env.LLM_MAX_ATTEMPTS) || 2),
    // Hard ceiling for the whole interpretation step, well inside the 30 s judge timeout.
    budgetMs: Number(env.LLM_BUDGET_MS) || 25000,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIN_ATTEMPT_MS = 2500; // below this there is not enough time left for a retry to be worth starting

/** Remaining time for one provider call: never more than the per-attempt timeout, never past the deadline. */
export const attemptTimeout = (config, deadline, now = Date.now()) => Math.min(config.timeoutMs, deadline - now);

async function chat(config, messages, deadline, extras = true) {
  // Hard ceiling: every attempt, including recursive ones, is clamped to the time left in the
  // budget, so no retry sequence can run past it and into the judge's per-request timeout.
  const timeout = attemptTimeout(config, deadline);
  if (timeout <= 0) throw new InterpretationError('interpretation budget exhausted');
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 1200,
      ...(extras
        ? {
            response_format: { type: 'json_object' },
            // Reasoning models burn hidden tokens; the task is extraction, not deduction.
            ...(/gpt-oss|reason/i.test(config.model) ? { reasoning_effort: 'low' } : {}),
          }
        : {}),
      messages,
    }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    // A 400 usually means this model rejects response_format/reasoning_effort; the prompt already
    // demands a bare JSON object, so retry once without the extras rather than failing.
    if (res.status === 400 && extras) return chat(config, messages, deadline, false);
    // Rate limited: wait the provider's own Retry-After if the retry still fits the budget.
    // A slow success beats a 5xx — a failed case loses interpretation, application and cost credit.
    if (res.status === 429) {
      const waitMs = Math.ceil((Number(res.headers.get('retry-after')) || 2) * 1000) + 250;
      if (Date.now() + waitMs + MIN_ATTEMPT_MS <= deadline) {
        await sleep(waitMs);
        return chat(config, messages, deadline, extras);
      }
    }
    // Body may echo request details; never surface it to the caller.
    throw new InterpretationError(`provider responded with HTTP ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new InterpretationError('provider returned an empty completion');
  return content;
}

/** Tolerate code fences or stray prose around the JSON object. */
export function parseModelJson(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new InterpretationError('model output contained no JSON object');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new InterpretationError('model output was not parseable JSON');
  }
}

/**
 * Interpret every operator note, then guardrail the result before it is returned.
 * A rejected attempt is retried once with the guardrail message as feedback; it is never
 * repaired by guessing, and a failed note is never silently downgraded to no_op.
 *
 * @param {(messages: Array) => Promise<string>} [complete] injected completion fn (tests/mock)
 * @returns {Promise<Array>} validated directive_interpretation entries
 */
export async function interpretNotes({ notes, battery, config, complete }) {
  // One budget for the whole interpretation step, so retries can never exceed the judge timeout.
  const deadline = Date.now() + (config?.budgetMs ?? 25000);
  const call = complete ?? ((messages) => chat(config, messages, deadline));
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(notes, battery) },
  ];
  const attempts = Math.max(1, config?.maxAttempts ?? 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1 && Date.now() + MIN_ATTEMPT_MS > deadline) break;
    try {
      const raw = await call(messages);
      const parsed = parseModelJson(raw);
      const verdict = validateInterpretation(parsed, { noteCount: notes.length, capacityKwh: battery.capacity_kwh });
      if (verdict.ok) return verdict.directives;
      lastError = new InterpretationError(`guardrail rejected the interpretation: ${verdict.error}`);
      if (attempt < attempts) {
        messages.push({ role: 'assistant', content: raw });
        messages.push({
          role: 'user',
          content: `Your previous JSON was rejected by the deterministic validator: ${verdict.error}. Re-read the rules and return the corrected JSON object only.`,
        });
      }
    } catch (err) {
      lastError = err instanceof InterpretationError ? err : new InterpretationError(err?.name === 'TimeoutError' ? 'provider request timed out' : 'provider request failed');
      if (attempt < attempts) messages.splice(2); // drop repair turns, retry clean
    }
  }
  throw lastError;
}
