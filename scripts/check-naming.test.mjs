import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNaming } from './check-naming.mjs';

test('accepts role-specific owned declarations', () => {
  assert.deepEqual(checkNaming('auction/application/auction.result.ts', 'export type AuctionResult = {};'), []);
  assert.deepEqual(checkNaming('auction/adapter/in/web/auction.response.ts', 'export type AuctionResponse = {};'), []);
});

test('rejects legacy declaration suffixes', () => {
  for (const name of ['AuctionDomain', 'AuctionDto', 'AuctionDTO', 'AuctionServiceImpl']) {
    assert.equal(checkNaming('auction/auction.ts', `export class ${name} {}`).length, 1);
  }
});

test('distinguishes application results from web responses', () => {
  assert.equal(checkNaming('auction/application/auction.response.ts', 'export type AuctionResponse = {};').length, 1);
});

test('requires portable kebab-case filenames and adapter suffixes', () => {
  assert.ok(checkNaming('auction/auction copy.ts', '').length);
  assert.ok(checkNaming('auction/adapter/out/auction.ts', 'export class AuctionPrismaAdapter {}').length);
  assert.deepEqual(checkNaming('auction/adapter/out/auction-prisma.adapter.ts', 'export class AuctionPrismaAdapter {}'), []);
});

test('does not reject legacy text or imported SDK symbols', () => {
  assert.deepEqual(checkNaming('auction/auction.ts', 'import { ExternalDto } from "sdk"; const message = "OldDomain";'), []);
});
