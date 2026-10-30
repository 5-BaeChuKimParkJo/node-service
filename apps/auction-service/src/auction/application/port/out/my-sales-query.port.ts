import type { MySalesPageRecord, MySalesQuery } from '../../model/my-sales.result';

export abstract class MySalesQueryPort {
  abstract list(memberUuid: string, query: MySalesQuery, now: Date): Promise<MySalesPageRecord>;
}
