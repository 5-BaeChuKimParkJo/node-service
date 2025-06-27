import { z } from 'zod';
import { auctionViewedForCreateBulkPropsSchema } from '../schema/auction-viewed-for-create-bulk.schema';

export type AuctionViewedForCreateBulkProps = z.infer<typeof auctionViewedForCreateBulkPropsSchema>;

export type AuctionViewedForCreateBulkArgs = AuctionViewedForCreateBulkProps[];

export default class AuctionViewedForCreateBulkDomain {
  props: AuctionViewedForCreateBulkProps[];

  constructor(viewers: AuctionViewedForCreateBulkArgs) {
    const props: AuctionViewedForCreateBulkProps[] = viewers;
    this.props = auctionViewedForCreateBulkPropsSchema.array().parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
