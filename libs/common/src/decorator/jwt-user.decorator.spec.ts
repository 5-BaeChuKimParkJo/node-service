import * as jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { verifyAccessToken } from './jwt-user.decorator';

const secret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const memberUuid = '123e4567-e89b-42d3-a456-426614174000';

describe('verifyAccessToken', () => {
  it('accepts a signed account access token', () => {
    const token = jwt.sign(
      { memberUuid, role: 'user', token_type: 'access' },
      secret,
      { algorithm: 'HS512', issuer: 'cn-account', expiresIn: '5m' },
    );

    expect(verifyAccessToken(token, secret)).toMatchObject({
      memberUuid,
      role: 'user',
    });
  });

  it('rejects forged, expired, refresh, and wrong-issuer tokens', () => {
    const cases = [
      jwt.sign({ memberUuid, role: 'user', token_type: 'access' }, 'x'.repeat(64), {
        algorithm: 'HS512', issuer: 'cn-account', expiresIn: '5m',
      }),
      jwt.sign({ memberUuid, role: 'user', token_type: 'access' }, secret, {
        algorithm: 'HS512', issuer: 'cn-account', expiresIn: -1,
      }),
      jwt.sign({ memberUuid, role: 'user', token_type: 'refresh' }, secret, {
        algorithm: 'HS512', issuer: 'cn-account-refresh', expiresIn: '5m',
      }),
      jwt.sign({ memberUuid, role: 'user', token_type: 'access' }, secret, {
        algorithm: 'HS512', issuer: 'someone-else', expiresIn: '5m',
      }),
    ];

    cases.forEach((token) => expect(() => verifyAccessToken(token, secret)).toThrow());
  });
});
