import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const config = JSON.parse(read('tsconfig.json'));

describe('TypeScript zero-error quality gate', () => {
  it('enables checkJs and noEmit across application and API JavaScript', () => {
    expect(config.compilerOptions.allowJs).toBe(true);
    expect(config.compilerOptions.checkJs).toBe(true);
    expect(config.compilerOptions.noEmit).toBe(true);
    expect(config.include).toEqual(expect.arrayContaining(['js/**/*.js', 'api/**/*.js', 'templates/**/*.js']));
  });

  it('runs TypeScript directly, not through a legacy baseline', () => {
    expect(pkg.scripts['check:types']).toMatch(/^tsc\b/);
    expect(pkg.scripts.check).toContain('npm run check:types');
    expect(pkg.scripts['check:types']).not.toMatch(/baseline|check-types\.js/);
    expect(pkg.devDependencies.typescript).toBe('5.8.3');
    expect(pkg.devDependencies['@types/node']).toBe('22.15.30');
  });

  it('runs the type gate in CI for pull requests to main', () => {
    const workflow = read('.github/workflows/quality-checks.yml');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('run: npm run check');
  });
});
