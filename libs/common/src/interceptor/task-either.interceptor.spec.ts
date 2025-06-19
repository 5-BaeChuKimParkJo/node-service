import { CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { TaskEitherInterceptor } from './task-either.interceptor';
import { of } from 'rxjs';
import * as TE from 'fp-ts/TaskEither';

const taskEitherInterceptor = new TaskEitherInterceptor();

describe('TaskEitherInterceptor', () => {
  describe('intercept', () => {
    it('value', async () => {
      const callHandler: CallHandler = { handle: () => of('hi') };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe((result) => expect(result).toBe('hi'));
    });

    it('function', async () => {
      const callHandler: CallHandler = { handle: () => of(() => 'hi') };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe((result) => expect(result).toBe('hi'));
    });

    it('async function', async () => {
      const callHandler: CallHandler = { handle: () => of(async () => 'hi') };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe((result) => expect(result).toBe('hi'));
    });

    it('TE.right', async () => {
      const callHandler: CallHandler = { handle: () => of(TE.right('hi')) };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe((result) => expect(result).toBe('hi'));
    });

    it('throw Error', async () => {
      const callHandler: CallHandler = {
        handle: () =>
          of(() => {
            throw new Error('hi');
          }),
      };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe({
        error: (e) => expect(e.message).toBe('hi'),
      });
    });

    it('throw HttpException', async () => {
      const callHandler: CallHandler = {
        handle: () =>
          of(() => {
            throw new HttpException('hi', HttpStatus.NOT_FOUND);
          }),
      };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe({
        error: (e) => {
          expect(e.message).toBe('hi');
          expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
        },
      });
    });

    it('TE.left(value)', async () => {
      const callHandler: CallHandler = { handle: () => of(TE.left('hi')) };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe({
        error: (e) => expect(e).toBe('hi'),
      });
    });

    it('TE.left(Error)', async () => {
      const callHandler: CallHandler = { handle: () => of(TE.left(new Error('hi'))) };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe({
        error: (e) => {
          expect(e).not.toBeInstanceOf(HttpException);
          expect(e.message).toBe('hi');
        },
      });
    });

    it('TE.left(HttpException)', async () => {
      const callHandler: CallHandler = { handle: () => of(TE.left(new HttpException('hi', HttpStatus.NOT_FOUND))) };
      taskEitherInterceptor.intercept(undefined as any, callHandler).subscribe({
        error: (e) => {
          expect(e.message).toBe('hi');
          expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
        },
      });
    });
  });
});
