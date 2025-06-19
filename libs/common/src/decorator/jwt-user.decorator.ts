import { createParamDecorator, ExecutionContext, HttpStatus } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { User } from '../types/user';
import { ErrorCode, AppException } from '../common';

export const JwtUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User => {
  // userToken1. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiYjUwMTg4ZTktYjQxOC00YjNkLThkZTMtYjEyNjU5NmQ5YzY5IiwiaWF0IjoxNzE4NDEwNjAzfQ.qMoG1Ldz9Nn6qweB2IlU6A9P4_EsfpckY2K2jL8VfFA
  // userToken2. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiYjg4N2RjZGMtMTk3My00NmM2LWIxYzktYzgyYmVjZjkzZmFhIiwiaWF0IjoxNzE4NDEwNjAzfQ.u3DukwTCAgBrGFtKmwTrDJlm6ibVKKoNgTAwaj94gk4
  // userToken3. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiNjM2NzZkNzUtNTJjZC00NjZkLWE4NDItODQ5MDI2ZGE4OWE1IiwiaWF0IjoxNzE4NDEwNjAzfQ.LKZdXyIXIkcRzWYws9xT2wvIRFPmH5O8xN8m6-jVNDQ
  // userToken4. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiMjU1ZTRiNGMtZmZlNC00YjU3LWI2NWEtY2YyNzdlNjg0NGY0IiwiaWF0IjoxNzE4NDEwNjAzfQ.3IHe45O_3XowBIxLg9Gh4DWEPPz48PgDMZNUOwOOCgY

  // 개발기: eyJhbGciOiJIUzUxMiJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwicm9sZSI6Im1lbWJlciIsIm1lbWJlclV1aWQiOiJmNDdlZmJkMS1iMWI0LTRjYjUtOTNhZC1jMDIzYzY4OTU4N2UiLCJpYXQiOjE3NTAyMzYxNTAsImV4cCI6MTc1MDIzNjc1NH0.47G6ZZoPRThdJ7t5T-XXS5LVg1KIN5DDFgEmksWaNd6GZYdJb0LAVPu8vESn6_kCsrwR5OOsWl1saicv7FBCHw

  // adminToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJVdWlkIjoiY2I1M2RhYzctY2UzNC00Y2FlLWIwYmQtMmJkNjk0ODFjMGM2Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4NDEwNjAzfQ.u4VG20b47g_5Nlv_aQ2XSV4wccVwJYu3fD-rLgQo0zg
  const request = ctx.switchToHttp().getRequest();
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppException({ message: 'JWT 토큰 형식 에러', code: ErrorCode.UNAUTHORIZED }, HttpStatus.UNAUTHORIZED);
  }
  const token = authHeader?.split(' ')[1];
  try {
    return jwt.decode(token) as User;
  } catch (err) {
    throw new AppException({ message: 'JWT 토큰 에러', code: ErrorCode.UNAUTHORIZED }, HttpStatus.UNAUTHORIZED);
  }
});
