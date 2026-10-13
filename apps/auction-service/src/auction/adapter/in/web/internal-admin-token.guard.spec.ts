import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalAdminTokenGuard } from './internal-admin-token.guard';

const context = (token?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: token ? { 'x-admin-internal-token': token } : {} }),
    }),
  }) as ExecutionContext;

describe('InternalAdminTokenGuard', () => {
  const guard = new InternalAdminTokenGuard(
    new ConfigService({ ADMIN_INTERNAL_TOKEN: 'a-secure-internal-token-that-is-long' }),
  );

  it('allows the configured internal token', () => {
    expect(guard.canActivate(context('a-secure-internal-token-that-is-long'))).toBe(true);
  });

  it('rejects missing or incorrect tokens', () => {
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('wrong-token'))).toThrow(UnauthorizedException);
  });
});
