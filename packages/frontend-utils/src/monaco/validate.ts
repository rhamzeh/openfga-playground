// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { validator } from '@openfga/syntax-transformer';
import { DSLSyntaxSingleError, ModelValidationSingleError } from '@openfga/syntax-transformer/dist/errors.js';

export interface MarkerWithExtra extends Monaco.editor.IMarkerData {
  extraInformation?: {
    error?: string;
    typeName?: string;
    relation?: string;
  };
}

/**
 * Validate a DSL string and return Monaco marker data for all errors.
 * Returns an empty array when the model is valid.
 */
export function validateDSL(monaco: typeof Monaco, dsl: string): MarkerWithExtra[] {
  const markers: MarkerWithExtra[] = [];
  try {
    validator.validateDSL(dsl);
  } catch (err) {
    const e = err as { errors?: unknown[] };
    if (!e.errors) return markers;

    for (const singleErr of e.errors) {
      let source: string;
      if (singleErr instanceof DSLSyntaxSingleError) {
        source = 'SyntaxError';
      } else if (singleErr instanceof ModelValidationSingleError) {
        source = 'ModelValidationError';
      } else {
        throw new Error('Unhandled Exception: ' + JSON.stringify(singleErr, null, 2));
      }

      const se = singleErr as DSLSyntaxSingleError | ModelValidationSingleError;
      const extraInformation: MarkerWithExtra['extraInformation'] = {};
      const errorMetadata = se.metadata;
      if (errorMetadata) {
        if ('errorType' in errorMetadata) extraInformation.error = String(errorMetadata.errorType);
        for (const field of ['typeName', 'relation'] as const) {
          if (field in errorMetadata) extraInformation[field] = String((errorMetadata as Record<string, unknown>)[field]);
        }
      }

      // Monaco ranges are 1-based
      markers.push({
        message: se.msg,
        severity: monaco.MarkerSeverity.Error,
        startColumn: (se.column?.start ?? 0) + 1,
        endColumn: (se.column?.end ?? 0) + 1,
        startLineNumber: (se.line?.start ?? 0) + 1,
        endLineNumber: (se.line?.end ?? 0) + 1,
        source,
        extraInformation,
      });
    }
  }
  return markers;
}
