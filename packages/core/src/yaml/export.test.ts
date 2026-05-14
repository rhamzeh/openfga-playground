// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { exportYaml } from './export.js';
import { importYaml } from './import.js';

describe('exportYaml', () => {
  it('serializes model, tuples, and assertions', () => {
    const output = exportYaml({
      name: 'test',
      model: 'model\n  schema 1.1\ntype user',
      tuples: [{ user: 'user:anne', relation: 'owner', object: 'repo:fga' }],
      assertions: [{ user: 'user:anne', relation: 'owner', object: 'repo:fga', expectation: true }],
    });

    expect(output).toContain('name: test');
    expect(output).toContain('schema 1.1');
    expect(output).toContain('user: user:anne');
    expect(output).toContain('expectation: true');
  });

  it('omits empty tuples and assertions', () => {
    const output = exportYaml({ model: 'type user', tuples: [], assertions: [] });

    expect(output).not.toContain('tuples');
    expect(output).not.toContain('assertions');
  });

  it('round-trips through import → export', () => {
    const original = `name: round-trip\nmodel: "type user"\ntuples:\n  - user: user:a\n    relation: r\n    object: o:1\n`;
    const imported = importYaml(original);
    const exported = exportYaml({
      name: imported.name,
      model: imported.model ?? '',
      tuples: imported.tuples ?? [],
      assertions: imported.assertions ?? [],
    });
    const reimported = importYaml(exported);

    expect(reimported.name).toBe(imported.name);
    expect(reimported.model).toBe(imported.model);
    expect(reimported.tuples).toEqual(imported.tuples);
  });
});
