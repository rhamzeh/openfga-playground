// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { importYaml } from './import.js';

const SAMPLE_YAML = `
name: github
model: |
  model
    schema 1.1
  type user
  type repo
    relations
      define owner: [user]
      define reader: [user] or owner
tuples:
  - user: user:anne
    relation: owner
    object: repo:openfga
assertions:
  - user: user:anne
    relation: reader
    object: repo:openfga
    expectation: true
  - user: user:bob
    relation: owner
    object: repo:openfga
    expectation: false
`;

describe('importYaml', () => {
  it('parses a full .fga.yaml file', () => {
    const result = importYaml(SAMPLE_YAML);

    expect(result.name).toBe('github');
    expect(result.model).toContain('schema 1.1');
    expect(result.tuples).toHaveLength(1);
    expect(result.tuples![0]).toEqual({ user: 'user:anne', relation: 'owner', object: 'repo:openfga' });
    expect(result.assertions).toHaveLength(2);
    expect(result.assertions![0].expectation).toBe(true);
    expect(result.assertions![1].expectation).toBe(false);
  });

  it('returns a warning for model_file references', () => {
    const yaml = `model_file: model.fga\ntuples: []`;
    const result = importYaml(yaml);

    expect(result.model).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]).toMatch(/model_file/);
  });

  it('handles missing optional fields gracefully', () => {
    const result = importYaml('model: "type user"\n');

    expect(result.tuples).toBeUndefined();
    expect(result.assertions).toBeUndefined();
    expect(result.warnings).toHaveLength(0);
  });

  it('throws on invalid YAML', () => {
    expect(() => importYaml('{ invalid: yaml: :')).toThrow('Invalid YAML');
  });

  it('throws on non-object YAML', () => {
    expect(() => importYaml('"just a string"')).toThrow('YAML must be an object');
  });
});
