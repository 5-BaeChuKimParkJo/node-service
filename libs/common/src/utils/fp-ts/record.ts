import * as Ord from 'fp-ts/Ord';
import * as Eq from 'fp-ts/Eq';

export const eqBy = <Rec, Key extends Partial<Rec>>(eqs: { [K in keyof Key]: Eq.Eq<Key[K]> }) =>
  Eq.struct(eqs) as Eq.Eq<Rec>;

export const ordBy = <Rec, Key extends keyof Rec>(key: Key, ord: Ord.Ord<Rec[Key]>) =>
  Ord.contramap((record: Rec) => record[key])(ord);

export default {
  ordBy,
  eqBy,
};
