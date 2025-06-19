import * as Eq from 'fp-ts/Eq';

export const partialStruct = <Origin, Equal extends Partial<Origin>>(eqs: { [K in keyof Equal]: Eq.Eq<Equal[K]> }) =>
  Eq.struct(eqs) as Eq.Eq<Origin>;
