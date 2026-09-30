import { describe, expect, it } from 'vitest';
import { assertOwnedAuctionImageKey } from './auction-image-key';

describe('assertOwnedAuctionImageKey', () => {
  it('accepts only generated keys owned by the requesting member', () => {
    const memberUuid = '123e4567-e89b-42d3-a456-426614174000';
    expect(() =>
      assertOwnedAuctionImageKey(
        `${memberUuid}_123e4567-e89b-42d3-a456-426614174001.webp`,
        memberUuid,
      ),
    ).not.toThrow();

    expect(() =>
      assertOwnedAuctionImageKey(
        `223e4567-e89b-42d3-a456-426614174000_123e4567-e89b-42d3-a456-426614174001.webp`,
        memberUuid,
      ),
    ).toThrow();
    expect(() => assertOwnedAuctionImageKey('https://evil.test/a.png', memberUuid)).toThrow();
    expect(() => assertOwnedAuctionImageKey('../a.png', memberUuid)).toThrow();
  });
});
