// SPDX-License-Identifier: Apache-2.0

import type * as Monaco from 'monaco-editor';
import { errors } from '@openfga/syntax-transformer';
import { Keyword, SINGLE_INDENTATION, SchemaVersion } from '../../constants/index.js';

interface FixContext {
  model: Monaco.editor.ITextModel;
  marker: Monaco.editor.IMarkerData & { extraInformation?: { error?: string; relation?: string } };
  markerRange: Monaco.Range;
  text: string;
  relation?: string;
}

interface FixContent {
  title: string;
  text: string;
  startLineNumber?: number;
  startColumn?: number;
}

type FixFactory = (ctx: FixContext) => FixContent | undefined;

const I = SINGLE_INDENTATION;

const errorFixesByErrorCodeAndSchema: Record<string, Partial<Record<SchemaVersion, FixFactory>>> = {
  [errors.ValidationError.MissingDefinition]: {
    [SchemaVersion.OneDotOne]: ({ model, marker, relation }) => {
      if (!relation) return undefined;
      const lineContent = model.getLineContent(marker.startLineNumber ?? 1);
      return {
        startColumn: 0,
        title: `Fix: add definition for \`${relation}\`.`,
        text: `${I}${I}${Keyword.DEFINE} ${relation}: [typeName]\n${lineContent}`,
      };
    },
    [SchemaVersion.OneDotTwo]: ({ model, marker, relation }) => {
      if (!relation) return undefined;
      const lineContent = model.getLineContent(marker.startLineNumber ?? 1);
      return {
        startColumn: 0,
        title: `Fix: add definition for \`${relation}\`.`,
        text: `${I}${I}${Keyword.DEFINE} ${relation}: [typeName]\n${lineContent}`,
      };
    },
  },
  [errors.ValidationError.SelfError]: {
    [SchemaVersion.OneDotOne]: ({ text }) => ({
      title: `Fix: replace \`${text}\` with type restrictions.`,
      text: '[typeName]',
    }),
    [SchemaVersion.OneDotTwo]: ({ text }) => ({
      title: `Fix: replace \`${text}\` with type restrictions.`,
      text: '[typeName]',
    }),
  },
  [errors.ValidationError.DuplicatedError]: {
    [SchemaVersion.OneDotOne]: ({ model, marker, markerRange, text }) => ({
      startLineNumber: markerRange.startLineNumber - 1,
      startColumn: model.getLineContent(marker.startLineNumber! - 1).length + 1,
      title: `Fix: remove duplicated \`${text}\`.`,
      text: '',
    }),
    [SchemaVersion.OneDotTwo]: ({ model, marker, markerRange, text }) => ({
      startLineNumber: markerRange.startLineNumber - 1,
      startColumn: model.getLineContent(marker.startLineNumber! - 1).length + 1,
      title: `Fix: remove duplicated \`${text}\`.`,
      text: '',
    }),
  },
};

function getCodeAction(ctx: FixContext, schemaVersion: SchemaVersion): Monaco.languages.CodeAction | undefined {
  const { markerRange, model, marker } = ctx;
  const errorCode = marker.extraInformation?.error;
  if (!errorCode) return undefined;

  const fixContent = errorFixesByErrorCodeAndSchema[errorCode]?.[schemaVersion]?.(ctx);
  if (!fixContent) return undefined;

  const editRange = new (markerRange as unknown as { constructor: new (...args: unknown[]) => Monaco.Range }).constructor(
    fixContent.startLineNumber ?? markerRange.startLineNumber,
    fixContent.startColumn ?? markerRange.startColumn,
    markerRange.endLineNumber,
    markerRange.endColumn,
  ) as Monaco.Range;

  return {
    title: fixContent.title,
    diagnostics: [marker as Monaco.editor.IMarkerData],
    edit: {
      edits: [
        {
          textEdit: { range: editRange, text: fixContent.text },
          resource: model.uri,
          versionId: undefined,
        },
      ],
    },
    kind: 'quickfix',
  };
}

/**
 * Returns a Monaco code action provider that offers quick-fixes for DSL validation errors.
 */
export function provideCodeActions(
  monaco: typeof Monaco,
  schemaVersion: SchemaVersion,
): Monaco.languages.CodeActionProvider['provideCodeActions'] {
  return (model, _range, context) => {
    const codeActions: Monaco.languages.CodeAction[] = [];

    for (const marker of context.markers) {
      const startOffset = model.getOffsetAt({ column: marker.startColumn, lineNumber: marker.startLineNumber });
      const endOffset = model.getOffsetAt({ column: marker.endColumn, lineNumber: marker.endLineNumber });
      const text = model.getValue().substring(startOffset, endOffset);
      const markerRange = new monaco.Range(
        marker.startLineNumber, marker.startColumn,
        marker.endLineNumber, marker.endColumn,
      );

      const action = getCodeAction(
        { markerRange, model, marker: marker as FixContext['marker'], text, relation: (marker as FixContext['marker']).extraInformation?.relation },
        schemaVersion,
      );
      if (action) codeActions.push(action);
    }

    return { actions: codeActions, dispose() {} };
  };
}
