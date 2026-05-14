// SPDX-License-Identifier: Apache-2.0
import yaml from 'js-yaml';
import type { TupleKey } from '@openfga/sdk';
import type { AssertionData } from '../types.js';

export interface ExportInput {
  name?: string;
  model: string;
  tuples: TupleKey[];
  assertions: AssertionData[];
}

/**
 * Serialize playground state to `.fga.yaml` format.
 * The output is compatible with the `fga` CLI and `openfga/sample-stores`.
 */
export function exportYaml(input: ExportInput): string {
  const doc: Record<string, unknown> = {};

  if (input.name) {
    doc.name = input.name;
  }

  if (input.model.trim()) {
    doc.model = input.model;
  }

  if (input.tuples.length > 0) {
    doc.tuples = input.tuples.map((t) => ({
      user: t.user,
      relation: t.relation,
      object: t.object,
    }));
  }

  if (input.assertions.length > 0) {
    doc.assertions = input.assertions.map((a) => ({
      user: a.user,
      relation: a.relation,
      object: a.object,
      expectation: a.expectation,
    }));
  }

  return yaml.dump(doc, {
    lineWidth: -1,    // no line wrapping
    quotingType: '"', // consistent quoting
  });
}
