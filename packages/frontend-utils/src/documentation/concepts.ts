// SPDX-License-Identifier: Apache-2.0

export interface DocumentationEntry {
  summary: string;
  link?: string;
}

export type DocumentationMap = Record<string, DocumentationEntry>;

/**
 * Documentation entries for core DSL keywords shown in Monaco hover tooltips.
 *
 * Keys are the literal DSL keyword strings (e.g. `'type'`, `'and'`).
 * Extend this map by passing a custom `DocumentationMap` to `registerDSL()`.
 */
export const defaultDocumentationMap: DocumentationMap = {
  type: {
    summary: `A **type** is a grouping of objects that have similar characteristics. Examples:
- \`workspace\`
- \`repository\`
- \`organization\`
- \`document\``,
    link: 'https://openfga.dev/docs/concepts#what-is-a-type',
  },
  relations: {
    summary:
      'A **relation** defines the possible relationship between an [object](https://openfga.dev/docs/concepts#what-is-an-object) and a [user](https://openfga.dev/docs/concepts#what-is-a-user).',
    link: 'https://openfga.dev/docs/concepts#what-is-a-relation',
  },
  define: {
    summary:
      'The `define` keyword specifies the relation definition — who can have this relation to an object of this type.',
    link: 'https://openfga.dev/docs/configuration-language#the-define-keyword',
  },
  and: {
    summary:
      'The **intersection** operator. A relationship exists if the user is in **all** of the specified user sets.',
    link: 'https://openfga.dev/docs/configuration-language#the-intersection-operator',
  },
  or: {
    summary:
      'The **union** operator. A relationship exists if the user is in **any** of the specified user sets.',
    link: 'https://openfga.dev/docs/configuration-language#the-union-operator',
  },
  'but not': {
    summary:
      'The **exclusion** operator. A relationship exists if the user is in the base userset but **not** in the subtracted userset.',
    link: 'https://openfga.dev/docs/configuration-language#the-exclusion-operator',
  },
  from: {
    summary: 'Allows referencing relations on **related objects** (tuple-to-userset).',
    link: 'https://openfga.dev/docs/configuration-language#referencing-relations-on-related-objects',
  },
  model: {
    summary: 'Declares the start of the authorization model block. Must be followed by a `schema` declaration.',
    link: 'https://openfga.dev/docs/configuration-language',
  },
  schema: {
    summary:
      'Specifies the DSL schema version. Current supported versions are `1.1` and `1.2`. Schema 1.0 is deprecated.',
    link: 'https://openfga.dev/docs/modeling/migrating/migrating-schema-1-1',
  },
  self: {
    summary:
      '`self` (schema 1.0) indicates direct assignment — a user can be directly assigned this relation. Use `[typeName]` in schema 1.1+.',
    link: 'https://openfga.dev/docs/modeling/migrating/migrating-schema-1-1',
  },
  condition: {
    summary:
      'Defines a **condition** — a CEL expression evaluated at check time. Conditions add context-aware access control.',
    link: 'https://openfga.dev/docs/modeling/conditions',
  },
  with: {
    summary:
      'Attaches a **condition** to a type restriction. The relationship is only granted when the condition evaluates to `true`.',
    link: 'https://openfga.dev/docs/modeling/conditions',
  },
  module: {
    summary:
      'Declares a **module** — a namespace for grouping types in modular authorization models.',
    link: 'https://openfga.dev/docs/modeling/modular-models',
  },
  extend: {
    summary:
      'Extends an existing type with additional relation definitions, used in modular models.',
    link: 'https://openfga.dev/docs/modeling/modular-models',
  },
};
