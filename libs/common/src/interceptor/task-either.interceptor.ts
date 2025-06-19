import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import * as E from 'fp-ts/Either';

const isEither = (value: any): value is E.Either<any, any> => {
  return value && typeof value === 'object' && '_tag' in value && (value._tag === 'Left' || value._tag === 'Right');
};

@Injectable()
export class TaskEitherInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      switchMap(async (result) => {
        if (typeof result === 'function') {
          try {
            const data = await result();
            if (!isEither(data)) {
              return data;
            } else if (E.isLeft(data)) {
              throw data.left;
            } else {
              return data.right;
            }
          } catch (e) {
            throw e;
          }
        }
        return result;
      }),
    );
  }
}
