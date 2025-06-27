import { dropLastIf } from './array';
import * as F from 'fp-ts/function';

describe('array', () => {
  describe('dropLastIf', () => {
    it('빈 배열일 때', () => {
      const array: number[] = [];
      const result = dropLastIf((x) => x === 5)(array);
      expect(result).toEqual([]);
    });

    it('마지막 아이템이 조건에 맞지 않을 때', () => {
      const array = [1, 2, 3, 4, 5];
      const result = dropLastIf((x) => x === 4)(array);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('마지막 아이템이 조건에 맞을 때', () => {
      const array = [1, 2, 3, 4, 5];
      const result = dropLastIf((x) => x === 5)(array);
      expect(result).toEqual([1, 2, 3, 4]);
    });
  });
});
