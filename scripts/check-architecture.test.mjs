import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkArchitecture } from './check-architecture.mjs';

test('rejects shared contracts importing an application-owned module', () => {
  const errors = fixture({
    'src/libs/common/src/types/event.ts': "import { db } from '../../../../apps/auction-service/src/database';",
    'src/apps/auction-service/src/database.ts': 'export const db = 1;',
  });
  assert.ok(errors.some(error => error.rule === 'shared-to-application'), JSON.stringify(errors));
});

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'chalnak-architecture-'));
  writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: { baseUrl: '.', paths: { '@owned/*': ['src/*'] }, allowJs: true }, include: ['src/**/*'],
  }));
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(root, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, source);
  }
  try { return checkArchitecture(path.join(root, 'tsconfig.json')); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

for (const statement of [
  "import { database } from '../adapter/database';",
  "import type { database } from '@owned/adapter/database';",
  "export { database } from '@owned/adapter/database';",
  "type Input = import('@owned/adapter/database').database;",
  "const module = import('@owned/adapter/database');",
  "const module = require('@owned/adapter/database');",
]) {
  test(`rejects reversed dependency: ${statement}`, () => {
    const result = fixture({ 'src/application/service.ts': statement,
      'src/adapter/database.ts': 'export const database = 1; export type database = number;' });
    assert.ok(result.some(error => error.rule === 'inner-to-implementation'), JSON.stringify(result));
  });
}

test('follows an intermediate barrel instead of trusting its filename', () => {
  const errors = fixture({
    'src/application/service.ts': "import { database } from '../common';",
    'src/common.ts': "export * from './adapter/database';",
    'src/adapter/database.ts': 'export const database = 1;',
  });
  assert.ok(errors.some(error => error.rule === 'inner-to-implementation'));
});

test('rejects domain to application and unresolved owned modules', () => {
  const errors = fixture({ 'src/domain/model.ts': "import '../application/service'; import '@owned/missing';",
    'src/application/service.ts': 'export const value = 1;' });
  assert.ok(errors.some(error => error.rule === 'domain-to-application'));
  assert.ok(errors.some(error => error.rule === 'unresolved-owned-import'));
});

test('allows an adapter implementing an inner contract', () => {
  const errors = fixture({ 'src/adapter/database.ts': "import type { Record } from '../application/port';",
    'src/application/port.ts': "import type { Value } from '../domain/value'; export type Record = Value;",
    'src/domain/value.ts': 'export type Value = { id: string };' });
  assert.deepEqual(errors, []);
});

test('rejects variable dynamic imports in inner code', () => {
  const errors = fixture({ 'src/application/service.ts': 'declare const name: string; const service = import(name);' });
  assert.ok(errors.some(error => error.rule === 'unresolved-owned-import'));
});
