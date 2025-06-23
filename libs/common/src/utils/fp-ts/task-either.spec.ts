import * as TE from 'fp-ts/TaskEither';
import { U } from '.';

describe('task-either', () => {
  describe('retry', () => {
    it('성공하는 경우', async () => {
      const task = U.TE.retry(TE.of(1), 3);
      const result = await task();
      expect(result).toBe(1);
    });

    it('3회만에 성공하는 경우', async () => {
      let count = 0;
      function request(): TE.TaskEither<Error, number> {
        count++;
        if (count === 3) {
          return TE.of(count);
        }
        return TE.left(new Error('error'));
      }

      const task = U.TE.retry(request(), 3);
      const result = await task();
      expect(result).toBe(1);
    });
  });
});
