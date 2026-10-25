export type DemoAuctionCreationCommand = {
  templateUuid: string;
  mode: 'manual' | 'automatic';
  now: Date;
};
