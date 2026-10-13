import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class InternalAdminTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.getOrThrow<string>('ADMIN_INTERNAL_TOKEN');
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers['x-admin-internal-token'];
    const actual = Array.isArray(header) ? header[0] : header;

    if (!actual || actual.length !== expected.length) {
      throw new UnauthorizedException();
    }
    if (!timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
