import * as TE from 'fp-ts/TaskEither';
import { U } from '.';
import * as E from 'fp-ts/Either';
import * as Num from 'fp-ts/number';
import * as Str from 'fp-ts/string';
import * as F from 'fp-ts/function';

describe('task-either', () => {
  describe('retry', () => {
    it('1회만에 성공하는 경우', async () => {
      function request(): TE.TaskEither<string, number> {
        return TE.right(1);
      }

      const task = U.TE.retry(request, 2);
      const result = await task();
      expect(E.getEq(Str.Eq, Num.Eq).equals(result, E.right(1))).toBeTruthy();
    });

    it('2회만에 성공하는 경우', async () => {
      let count = 0;
      function request(): TE.TaskEither<string, number> {
        count++;
        if (count === 2) {
          return TE.right(count);
        }
        return TE.left(String(count));
      }

      const task = U.TE.retry(request, 2);
      const result = await task();
      expect(E.getEq(Str.Eq, Num.Eq).equals(result, E.right(2))).toBeTruthy();
    });

    it('3회만에 성공하는 경우', async () => {
      let count = 0;
      function request(): TE.TaskEither<string, number> {
        count++;
        if (count === 3) {
          return TE.right(count);
        }
        return TE.left(String(count));
      }

      const task = U.TE.retry(request, 2);
      const result = await task();
      expect(E.getEq(Str.Eq, Num.Eq).equals(result, E.right(3))).toBeTruthy();
    });

    it('4회만에 성공하는 경우', async () => {
      let count = 0;
      function request(): TE.TaskEither<string, number> {
        count++;
        if (count === 4) {
          return TE.right(count);
        }
        return TE.left(String(count));
      }

      const task = U.TE.retry(request, 2);
      const result = await task();
      expect(E.getEq(Str.Eq, Num.Eq).equals(result, E.left('3'))).toBeTruthy();
    });
  });

  describe('tapLeft', () => {
    it('right -> right', async () => {
      const obj = {
        fn: () => TE.right('error'),
      };
      const spy = vitest.spyOn(obj, 'fn');

      const result = await F.pipe(TE.right('success'), U.TE.tapLeft(obj.fn))();

      expect(spy).not.toHaveBeenCalled();
      expect(E.isRight(result)).toBeTruthy();
      expect(
        F.pipe(
          result,
          E.match(
            (e) => e,
            (a) => a,
          ),
        ),
      ).toBe('success');
    });
    it('right -> left', async () => {
      const obj = {
        fn: () => TE.right('error'),
      };
      const spy = vitest.spyOn(obj, 'fn');

      const result = await F.pipe(TE.right('success'), U.TE.tapLeft(obj.fn))();

      expect(spy).not.toHaveBeenCalled();
      expect(E.isRight(result)).toBeTruthy();
      expect(
        F.pipe(
          result,
          E.match(
            (e) => e,
            (a) => a,
          ),
        ),
      ).toBe('success');
    });
    it('left -> right', async () => {
      const obj = {
        fn: () => TE.right('error2'),
      };
      const spy = vitest.spyOn(obj, 'fn');

      const result = await F.pipe(TE.left('error'), U.TE.tapLeft(obj.fn))();

      expect(spy).toHaveBeenCalled();
      expect(E.isLeft(result)).toBeTruthy();
      expect(
        F.pipe(
          result,
          E.match(
            (e) => e,
            (a) => a,
          ),
        ),
      ).toBe('error');
    });
    it('left -> left', async () => {
      const obj = {
        fn: () => TE.left('error2'),
      };
      const spy = vitest.spyOn(obj, 'fn');

      const result = await F.pipe(TE.left('error'), U.TE.tapLeft(obj.fn))();

      expect(spy).toHaveBeenCalled();
      expect(E.isLeft(result)).toBeTruthy();
      expect(
        F.pipe(
          result,
          E.match(
            (e) => e,
            (a) => a,
          ),
        ),
      ).toBe('error2');
    });
  });
});
