import { CreateAuctionResult } from './create-auction.result';

export type DemoAuctionCreationResult =
  | { status: 'created'; auction: CreateAuctionResult }
  | { status: 'skipped-active' | 'skipped-busy' };
