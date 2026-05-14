// SPDX-License-Identifier: Apache-2.0
import yaml from 'js-yaml';
import type { TupleKey } from '@openfga/sdk';
import type { AssertionData } from '../types.js';

export interface ImportedState {
  name?: string;
  model?: string;
  tuples?: TupleKey[];
  assertions?: AssertionData[];
  warnings?: string[];
}

interface RawYaml {
  name?: string;
  model?: string;
  model_file?: string;
  tuples?: Array<{ user: string; relation: string; object: string }>;
  assertions?: Array<{
    user: string;
    relation: string;
    object: string;
    expectation: boolean;
  }>;
}

/**
 * Parse an `.fga.yaml` file and return the extracted playground state.
 *
 * Supports the format used by the `fga` CLI and `openfga/sample-stores`:
 *   - `model` (inline DSL string)
 *   - `tuples` (array of {user, relation, object})
 *   - `assertions` (array of {user, relation, object, expectation})
 *
 * `model_file` references are not resolved in v1; a warning is returned instead.
 */
export function importYaml(content: string): ImportedState {
  const warnings: string[] = [];
  let raw: RawYaml;

  try {
    raw = yaml.load(content) as RawYaml;
  } catch (err: unknown) {
    throw new Error(`Invalid YAML: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('YAML must be an object');
  }

  const result: ImportedState = { warnings };

  if (raw.name) {
    result.name = raw.name;
  }

  if (raw.model) {
    result.model = raw.model;
  } else if (raw.model_file) {
    warnings.push(
      `model_file references ('${raw.model_file}') are not resolved in v1. ` +
        'Paste the model DSL inline using the "model" key.',
    );
  }

  if (Array.isArray(raw.tuples)) {
    result.tuples = raw.tuples.map((t) => ({
      user: t.user,
      relation: t.relation,
      object: t.object,
    }));
  }

  if (Array.isArray(raw.assertions)) {
    result.assertions = raw.assertions.map((a) => ({
      user: a.user,
      relation: a.relation,
      object: a.object,
      expectation: Boolean(a.expectation),
    }));
  }

  return result;
}
