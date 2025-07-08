import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import * as F from 'fp-ts/function';

export const dropLastIf =
  <A>(predicate: (a: A) => boolean) =>
  (array: Array<A>): Array<A> =>
    F.pipe(
      A.last(array),
      O.match(
        () => array,
        (last) => (predicate(last) ? array.slice(0, -1) : array),
      ),
    );
