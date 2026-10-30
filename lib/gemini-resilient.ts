import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse, ThinkingLevel } from '@google/genai';

export const aiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

/**
 * Active models verified in this environment, ordered for reliability and independent quota buckets.
 * Rotating across these models prevents 429 daily/minute quota stops and recovers from repetition loops.
 */
export const RESILIENT_MODELS = [
  'gemini-3-flash-preview',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite-preview',
  'gemini-flash-lite-latest',
] as const;

declare global {
  // eslint-disable-next-line no-var
  var __badiniModelCooldownUntil: Map<string, number> | undefined;
}

function getModelCooldownMap(): Map<string, number> {
  if (!global.__badiniModelCooldownUntil) {
    global.__badiniModelCooldownUntil = new Map<string, number>();
  }
  return global.__badiniModelCooldownUntil;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Collapses pathological autoregressive repetition loops (e.g., when a model repeats the same
 * phrase 5+ times in a row inside a JSON string until hitting maxOutputTokens).
 */
export function collapseRepetitionLoops(input: string): string {
  if (!input || input.length < 200) return input;
  // Collapse any phrase of 6..120 characters repeated 4 or more times consecutively
  return input.replace(/(.{6,120}?)\1{3,}/g, '$1$1');
}

/**
 * Repairs truncated or slightly malformed JSON strings (such as "Unterminated string in JSON"
 * when an audio segment or dense page hits maxOutputTokens mid-string) by closing open strings,
 * stripping dangling keys/colons/commas, and closing open arrays/objects from the structural stack.
 */
export function parseOrRepairJson<T = Record<string, unknown>>(rawInput: string): T {
  let cleaned = (rawInput || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  cleaned = collapseRepetitionLoops(cleaned);

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Proceed to structural repair
  }

  // 2. Structural stack repair at progressive cut points
  const attemptRepairAt = (sliceStr: string): T | null => {
    let s = sliceStr;
    let inString = false;
    let escaped = false;
    const stack: ('{' | '[')[] = [];
    let lastStringStart = -1;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        if (inString) escaped = true;
        continue;
      }
      if (ch === '"') {
        if (!inString) {
          inString = true;
          lastStringStart = i;
        } else {
          inString = false;
        }
        continue;
      }
      if (!inString) {
        if (ch === '{' || ch === '[') {
          stack.push(ch);
        } else if (ch === '}') {
          if (stack.length > 0 && stack[stack.length - 1] === '{') stack.pop();
        } else if (ch === ']') {
          if (stack.length > 0 && stack[stack.length - 1] === '[') stack.pop();
        }
      }
    }

    // If terminated inside a string literal ("Unterminated string in JSON")
    if (inString) {
      // Cap runaway single string at 1500 chars from its start
      if (lastStringStart >= 0 && s.length - lastStringStart > 1500) {
        s = s.slice(0, lastStringStart + 1500);
      }
      // Remove any trailing lone backslash that would escape our closing quote
      s = s.replace(/\\+$/, '');
      s += '"';
    }

    // Clean up trailing tokens outside strings before closing brackets/braces
    s = s.trimEnd();

    // If it ends with a colon (e.g., `{"heading":`), or an uncolon'd key inside an object (e.g., `{"pages":[{"heading"`)
    // strip back to the last comma or opening brace/bracket
    const closeStack = (base: string): string => {
      let candidate = base.trimEnd();
      // Remove trailing comma
      candidate = candidate.replace(/,\s*$/, '');
      let suffix = '';
      for (let k = stack.length - 1; k >= 0; k--) {
        suffix += stack[k] === '{' ? '}' : ']';
      }
      return candidate + suffix;
    };

    try {
      return JSON.parse(closeStack(s)) as T;
    } catch {
      // If we ended on a partial object property like `,"heading"` or `,"paragraphs":`, strip back to last `,` or `{`
      const lastComma = s.lastIndexOf(',');
      const lastOpenBrace = s.lastIndexOf('{');
      const cutIdx = Math.max(lastComma, lastOpenBrace);
      if (cutIdx > 0) {
        const trimmed = cutIdx === lastComma ? s.slice(0, cutIdx) : s.slice(0, cutIdx + 1);
        try {
          return JSON.parse(closeStack(trimmed)) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  };

  const directRepaired = attemptRepairAt(cleaned);
  if (directRepaired) return directRepaired;

  // 3. Backtrack across previous closing braces `}` or quotes `"` to salvage all completed pages/paragraphs
  let searchPos = cleaned.length;
  for (let step = 0; step < 40; step++) {
    const prevBrace = cleaned.lastIndexOf('}', searchPos - 1);
    const prevBracket = cleaned.lastIndexOf(']', searchPos - 1);
    const prevQuote = cleaned.lastIndexOf('"', searchPos - 1);
    const nextPos = Math.max(prevBrace, prevBracket, prevQuote);
    if (nextPos <= 10) break;
    searchPos = nextPos;

    const candidate = attemptRepairAt(cleaned.slice(0, nextPos + 1));
    if (candidate) {
      return candidate;
    }
  }

  throw new Error('JSON_PARSE_FAILED');
}

export function sanitizeErrorMessageKurdish(err: unknown, fallbackMsg: string): string {
  if (!err) return fallbackMsg;
  const raw = err instanceof Error ? err.message : String(err);

  if (
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('quota') ||
    raw.includes('rate-limits')
  ) {
    return 'لۆدەکا زۆر ل سەر مۆدێلێ ئێکێ هەبوو — سیستەم ب شێوەیێ خۆکار دهێتە گوهۆڕین بۆ مۆدێلێ یەدەک، تکایە چەند چرکەیەکان چاڤەڕێ بکە یان دووبارە کلیک بکە.';
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return 'سێرڤەرێ وەرگێرانێ نوکە یێ بژویلە، تکایە دووبارە دوگمەیێ لێبدە.';
  }
  if (
    raw.toLowerCase().includes('failed to fetch') ||
    raw.toLowerCase().includes('networkerror') ||
    raw.toLowerCase().includes('load failed')
  ) {
    return 'پەیوەندیا ئینتەرنێتێ بۆ چرکەیەکێ لاواز بوو، تکایە دووبارە دوگمەیێ لێبدە.';
  }
  if (
    raw.includes('Unterminated string') ||
    raw.includes('Unexpected token') ||
    raw.includes('Unexpected end of JSON') ||
    raw.includes('JSON at position') ||
    raw.includes('JSON_PARSE_FAILED') ||
    raw.includes('SyntaxError')
  ) {
    return 'پشکەکا دەنگی گەلەک درێژ بوو، تکایە جارەکا دی دوگمەیێ لێبدە دا ب پشکێن هویرتر بهێتە نڤیسین.';
  }
  if (raw.trim().startsWith('{') || raw.includes('{"error"')) {
    return fallbackMsg;
  }
  return raw;
}

export async function generateContentResilient(
  params: Omit<GenerateContentParameters, 'model'> & {
    preferredModels?: readonly string[];
    fastMode?: boolean;
  },
  maxAttempts = 10
): Promise<GenerateContentResponse> {
  const modelsPool = params.preferredModels || RESILIENT_MODELS;
  const cooldownMap = getModelCooldownMap();
  let lastError: unknown = null;
  const isJsonExpected = params.config?.responseMimeType === 'application/json';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    const availableModels = modelsPool.filter((m) => {
      const until = cooldownMap.get(m) || 0;
      return until <= now;
    });

    const activePool = availableModels.length > 0 ? availableModels : modelsPool;
    const modelName = activePool[attempt % activePool.length];

    try {
      const supportsThinkingLevel = modelName === 'gemini-3-flash-preview';
      const baseConfig = { ...(params.config || {}) };

      if (!baseConfig.maxOutputTokens) {
        baseConfig.maxOutputTokens = params.fastMode ? 8192 : 32768;
      }

      if (supportsThinkingLevel && !baseConfig.thinkingConfig) {
        baseConfig.thinkingConfig = {
          thinkingLevel: params.fastMode ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW,
        };
      } else if (!supportsThinkingLevel) {
        if (params.fastMode) {
          baseConfig.thinkingConfig = { thinkingBudget: 0 };
        } else if (baseConfig.thinkingConfig) {
          delete baseConfig.thinkingConfig;
        }
      }

      const perAttemptTimeoutMs = params.fastMode ? 22000 : 38000;
      const response = await Promise.race([
        aiClient.models.generateContent({
          ...params,
          model: modelName,
          config: baseConfig,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GEMINI_ATTEMPT_TIMEOUT')), perAttemptTimeoutMs)
        ),
      ]);

      if (response && response.text) {
        if (isJsonExpected) {
          // Validate or repair JSON right here; if unrepairable or empty pages, retry with next model
          const repairedObj = parseOrRepairJson<Record<string, unknown>>(response.text);
          if (
            repairedObj &&
            typeof repairedObj === 'object' &&
            (!('pages' in repairedObj) ||
              (Array.isArray(repairedObj.pages) && repairedObj.pages.length > 0))
          ) {
            const cleanJsonText = JSON.stringify(repairedObj);
            Object.defineProperty(response, 'text', {
              value: cleanJsonText,
              writable: true,
              configurable: true,
            });
            return response;
          }
          throw new Error('JSON_PARSE_FAILED');
        }
        return response;
      }
    } catch (err: unknown) {
      lastError = err;
      const errStr = err instanceof Error ? err.message : String(err);

      // If this model timed out, cool it down briefly and immediately try the next model in the pool
      if (errStr.includes('GEMINI_ATTEMPT_TIMEOUT')) {
        cooldownMap.set(modelName, Date.now() + 12000);
        continue;
      }

      // Daily quota limit on this specific model -> 30 min cooldown, switch immediately
      if (
        errStr.includes('GenerateRequestsPerDayPerProjectPerModel') ||
        errStr.includes('free_tier_requests') ||
        errStr.includes('per day limit exceeded')
      ) {
        cooldownMap.set(modelName, Date.now() + 30 * 60 * 1000);
        await sleep(200);
        continue;
      }

      // Deprecated/404 model -> 24h cooldown
      if (errStr.includes('404') || errStr.includes('no longer available') || errStr.includes('not found')) {
        cooldownMap.set(modelName, Date.now() + 24 * 60 * 60 * 1000);
        await sleep(100);
        continue;
      }

      // If model produced truncated/unrepairable JSON, put on brief cooldown and try another model
      if (
        errStr.includes('JSON_PARSE_FAILED') ||
        errStr.includes('Unterminated string') ||
        errStr.includes('SyntaxError')
      ) {
        cooldownMap.set(modelName, Date.now() + 15000);
        await sleep(400);
        continue;
      }

      // RPM 429 or 503 transient errors
      if (errStr.includes('429') || errStr.includes('503') || errStr.includes('UNAVAILABLE')) {
        cooldownMap.set(modelName, Date.now() + 8000);
        await sleep(1000 * ((attempt % 3) + 1));
        continue;
      }

      await sleep(600 * (attempt + 1));
    }
  }

  throw new Error(
    sanitizeErrorMessageKurdish(
      lastError,
      'پەیوەندی ب سێرڤەرێ زیرەک ڤە بۆ چرکەیەکێ لاواز بوو، تکایە دووبارە هەول بدە.'
    )
  );
}
