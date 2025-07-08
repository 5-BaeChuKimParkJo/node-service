import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import * as F from 'fp-ts/function';

export const retry = <E, A>(task: () => TE.TaskEither<E, A>, maxRetries: number): TE.TaskEither<E, A> => {
  const loop = (attempt: number): T.Task<E.Either<E, A>> =>
    F.pipe(
      task(),
      T.flatMap((res) => (E.isLeft(res) && attempt < maxRetries ? loop(attempt + 1) : T.of(res))),
    );

  return loop(0);
};

export const tapLeft =
  <A, E1, E2, _>(f: (e: E1) => TE.TaskEither<E2, _>) =>
  (self: TE.TaskEither<E1, A>): TE.TaskEither<E2 | E1, A> =>
    F.pipe(
      self,
      TE.matchE(
        (e1) =>
          F.pipe(
            f(e1),
            TE.matchE(
              (e2) => TE.left<E1 | E2, A>(e2),
              () => TE.left<E1 | E2, A>(e1),
            ),
          ),
        (a) => TE.right(a),
      ),
    );
