import { describe, expect, it } from 'vitest';
import { findNewDiagnostics, parseDiagnostics } from '../scripts/check-types.js';

describe('GS-007: TypeScript checkJs quality gate', () => {
  it('reads location-based and configuration diagnostics', () => {
    const actual = parseDiagnostics([
      "js/form-renderer.js(23,9): error TS2339: Property 'value' does not exist on type 'Element'.",
      "error TS5058: The specified path does not exist: 'missing.json'.",
    ].join('\n'));
    expect(actual).toEqual([
      { file: 'js/form-renderer.js', code: 2339, message: "Property 'value' does not exist on type 'Element'." },
      { file: '<config>', code: 5058, message: "The specified path does not exist: 'missing.json'." },
    ]);
  });

  it('allows only the exact known diagnostic count and signature', () => {
    const old = { file: 'js/settings.js', code: 2339, message: 'Missing value.' };
    const baseline = [{ ...old, count: 2 }];
    expect(findNewDiagnostics([old, old], baseline)).toEqual([]);
    expect(findNewDiagnostics([old, old, old], baseline)).toEqual([old]);
    expect(findNewDiagnostics([{ ...old, file: 'js/ui.js' }], baseline)).toHaveLength(1);
    expect(findNewDiagnostics([{ ...old, message: 'New error.' }], baseline)).toHaveLength(1);
  });

  it('does not depend on line numbers when code is moved', () => {
    const baseline = [{ file: 'js/state.js', code: 2322, message: 'Wrong type.', count: 1 }];
    const actual = parseDiagnostics('js/state.js(999,12): error TS2322: Wrong type.');
    expect(findNewDiagnostics(actual, baseline)).toEqual([]);
  });
});
