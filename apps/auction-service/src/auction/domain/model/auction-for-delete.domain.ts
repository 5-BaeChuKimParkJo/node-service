import { User } from '@app/common';
import { auctionForDeletePropsSchema } from '../schema/auction-for-delete.schema';
import { z } from 'zod';

export type AuctionForDeleteProps = z.infer<typeof auctionForDeletePropsSchema>;

export type AuctionForDeleteArgs = Omit<AuctionForDeleteProps, 'sellerUuid'>;

export default class AuctionForDeleteDomain {
  private props: AuctionForDeleteProps;

  constructor(input: AuctionForDeleteArgs, user: User) {
    const props: AuctionForDeleteProps = { ...input, sellerUuid: user.memberUuid };
    this.props = auctionForDeletePropsSchema.parse(props);
  }

  getSnapshot = () => {
    return this.props;
  };
}
