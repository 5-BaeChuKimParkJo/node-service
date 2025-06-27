import { values } from './record';

describe('record', () => {
  describe('values', () => {
    it('동작 확인', () => {
      const record = { a: 1, b: 2, c: 3 };
      const result = values(record);
      expect(result).toEqual([1, 2, 3]);

      const record2 = { a: 1, b: '2', c: 3 };
      const result2 = values(record2);
      expect(result2).toEqual([1, '2', 3]);
    });
  });
});
