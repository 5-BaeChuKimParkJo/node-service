import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import { pipe } from 'fp-ts/function';

export const retry = <E, A>(task: TE.TaskEither<E, A>, maxRetries: number): TE.TaskEither<E, A> => {
  const loop = (attempt: number): T.Task<E.Either<E, A>> =>
    pipe(
      task,
      T.flatMap((res) => (E.isLeft(res) && attempt < maxRetries ? loop(attempt + 1) : T.of(res))),
    );

  return loop(0);
};
