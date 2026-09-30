import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User } from '../types/user';
import { ErrorCode, AppException } from '../common';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function verifyAccessToken(token: string, secret: string): User {
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256', 'HS384', 'HS512'],
    issuer: 'cn-account',
  });

  if (
    typeof payload === 'string' ||
    payload.token_type !== 'access' ||
    typeof payload.memberUuid !== 'string' ||
    !UUID_PATTERN.test(payload.memberUuid) ||
    !['admin', 'user', 'member'].includes(String(payload.role))
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token claims');
  }

  return {
    memberUuid: payload.memberUuid,
    role: payload.role as User['role'],
  };
}

export const JwtUser = createParamDecorator((_: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest();
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppException({ message: 'JWT 토큰 형식 에러', code: ErrorCode.UNAUTHORIZED }, HttpStatus.UNAUTHORIZED);
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is missing');
    }
    return verifyAccessToken(authHeader.slice('Bearer '.length), secret);
  } catch {
    throw new AppException({ message: 'JWT 토큰 에러', code: ErrorCode.UNAUTHORIZED }, HttpStatus.UNAUTHORIZED);
  }
});
