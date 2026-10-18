import { isTimeTruncated } from './date.utils';

describe('date utils', () => {
  it('isTimeTruncated', () => {
    expect(isTimeTruncated(new Date('2025-01-01T12:24:55.124Z'))).toBe(false);
    expect(isTimeTruncated(new Date('2025-01-01T12:00:00.000Z'))).toBe(true);
  });
});
