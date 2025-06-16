import * as Ord from 'fp-ts/Ord';

export const ordBy = <Rec, Key extends keyof Rec>(key: Key, ord: Ord.Ord<Rec[Key]>) =>
  Ord.contramap((record: Rec) => record[key])(ord);

export default {
  ordBy,
};
