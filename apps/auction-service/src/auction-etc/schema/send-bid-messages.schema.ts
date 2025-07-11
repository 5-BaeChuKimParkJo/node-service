import z from 'zod';

export const SendBidMessagesArgsSchema = z.object({
  bidderUuid: z.string(),
  requestId: z.string(),
  auctionUuid: z.string(),
  type: z.enum([
    'success',
    'success-max',
    'rejected-period',
    'rejected-amount',
    'rejected-too-high-bid',
    'rejected-duplicate',
    'rejected-seller',
  ]),
});

export type SendBidMessagesArgs = z.infer<typeof SendBidMessagesArgsSchema>;
