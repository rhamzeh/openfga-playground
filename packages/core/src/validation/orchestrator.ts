// SPDX-License-Identifier: Apache-2.0
import type { ValidationError } from '../types.js';

// The syntax-transformer package validates DSL and converts between formats.
// The API is namespaced: `transformer.*` and `validator.*`.
let transformerModule: typeof import('@openfga/syntax-transformer') | null = null;

async function getTransformer() {
  if (!transformerModule) {
    transformerModule = await import('@openfga/syntax-transformer');
  }
  return transformerModule;
}

/**
 * Validate a DSL string and return structured errors.
 * An empty array means the model is valid.
 */
export async function validateModel(dsl: string): Promise<ValidationError[]> {
  if (!dsl.trim()) {
    return [];
  }

  const mod = await getTransformer();

  try {
    // transformDSLToJSON returns a JSON string; throws on invalid DSL
    mod.transformer.transformDSLToJSON(dsl);
    return [];
  } catch (err: unknown) {
    return parseTransformerError(err);
  }
}

/**
 * Convert a DSL string to its JSON representation.
 * Returns null if the DSL is empty or invalid.
 */
export async function dslToJson(dsl: string): Promise<object | null> {
  if (!dsl.trim()) {
    return null;
  }

  const mod = await getTransformer();

  try {
    // transformDSLToJSON returns a JSON string; parse it to get the object
    const jsonStr = mod.transformer.transformDSLToJSON(dsl);
    return JSON.parse(jsonStr) as object;
  } catch {
    return null;
  }
}

/**
 * Convert a JSON authorization model to DSL string.
 * Returns null if conversion fails.
 */
export async function jsonToDsl(json: object): Promise<string | null> {
  const mod = await getTransformer();

  try {
    // transformJSONToDSL accepts an AuthorizationModel object (Omit<AuthorizationModel, "id">)
    return mod.transformer.transformJSONToDSL(
      json as Parameters<typeof mod.transformer.transformJSONToDSL>[0],
    );
  } catch {
    return null;
  }
}

/**
 * Parse an error from @openfga/syntax-transformer into structured ValidationErrors.
 */
function parseTransformerError(err: unknown): ValidationError[] {
  if (!(err instanceof Error)) {
    return [{ line: 1, column: 1, message: String(err) }];
  }

  const message = err.message;

  // Pattern: "line X, column Y: message" or "X:Y message"
  const lineColPattern = /(?:line\s+)?(\d+)(?:[,:]?\s*col(?:umn)?\s*(\d+))?[:\s]+(.+)/i;
  const match = message.match(lineColPattern);

  if (match) {
    return [
      {
        line: parseInt(match[1], 10),
        column: match[2] ? parseInt(match[2], 10) : 1,
        message: match[3].trim(),
      },
    ];
  }

  return [{ line: 1, column: 1, message }];
}

// ---------------------------------------------------------------------------
// Debounced validation
// ---------------------------------------------------------------------------

type ValidationCallback = (errors: ValidationError[], json: object | null) => void;

/**
 * Create a debounced validation function.
 *
 * @param callback Called with (errors, json) after the debounce period.
 * @param delayMs  Debounce delay in milliseconds (default: 300).
 */
export function createDebouncedValidator(
  callback: ValidationCallback,
  delayMs = 300,
): (dsl: string) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (dsl: string) => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(async () => {
      timer = null;
      const [errors, json] = await Promise.all([validateModel(dsl), dslToJson(dsl)]);
      callback(errors, json);
    }, delayMs);
  };
}
