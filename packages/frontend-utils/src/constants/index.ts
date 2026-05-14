// SPDX-License-Identifier: Apache-2.0

/** The Monaco language ID for the OpenFGA DSL. */
export const LANGUAGE_NAME = 'dsl.openfga';

/** Two-space indentation used in DSL code generation. */
export const SINGLE_INDENTATION = '  ';

/** Supported schema versions for the OpenFGA DSL. */
export enum SchemaVersion {
  OneDotZero = '1.0',
  OneDotOne = '1.1',
  OneDotTwo = '1.2',
}

export const DEFAULT_SCHEMA_VERSION = SchemaVersion.OneDotOne;

/** All DSL keywords recognized by the tokenizer and completion providers. */
export enum Keyword {
  TYPE = 'type',
  RELATIONS = 'relations',
  SELF = 'self',
  DEFINE = 'define',
  AS = 'as',
  OR = 'or',
  AND = 'and',
  FROM = 'from',
  WITH = 'with',
  BUT_NOT = 'but not',
  MODEL = 'model',
  SCHEMA = 'schema',
  MODULE = 'module',
  EXTEND = 'extend',
  CONDITION = 'condition',
}

export enum ReservedKeywords {
  THIS = 'this',
}
