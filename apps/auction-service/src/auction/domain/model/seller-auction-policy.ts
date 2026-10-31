import { z } from 'zod';

const version = z.number().int().min(0).max(2147483647);
const hour = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((value) => value.getUTCMinutes() === 0 && value.getUTCSeconds() === 0 && value.getUTCMilliseconds() === 0);
const updateSchema = z
  .object({
    version,
    title: z.string().trim().min(5).max(100),
    description: z.string().max(1000),
    minimumBid: z
      .string()
      .regex(/^[1-9]\d{3,15}$/)
      .refine((value) => BigInt(value) <= 9007199254740991n),
    startAt: hour,
    endAt: hour,
  })
  .strict()
  .refine((value) => value.endAt.getTime() - value.startAt.getTime() >= 3600000);
const cancelSchema = z
  .object({
    version,
    reasonCode: z.enum(['listing_error', 'item_unavailable', 'schedule_change', 'personal_reason', 'other']),
    reasonDetail: z.string().trim().min(1).max(200).optional(),
  })
  .strict()
  .refine((value) =>
    value.reasonCode === 'other' ? value.reasonDetail !== undefined : value.reasonDetail === undefined,
  );

export type UpdateSellerAuctionCommand = z.infer<typeof updateSchema> & { action: 'update' };
export type CancelSellerAuctionCommand = z.infer<typeof cancelSchema> & { action: 'cancel' };
export type SellerAuctionChange = UpdateSellerAuctionCommand | CancelSellerAuctionCommand;
export function parseSellerAuctionChange(value: unknown, action: 'update'): UpdateSellerAuctionCommand;
export function parseSellerAuctionChange(value: unknown, action: 'cancel'): CancelSellerAuctionCommand;
export function parseSellerAuctionChange(value: unknown, action: 'update' | 'cancel'): SellerAuctionChange;
export function parseSellerAuctionChange(value: unknown, action: 'update' | 'cancel'): SellerAuctionChange {
  return action === 'update' ? { ...updateSchema.parse(value), action } : { ...cancelSchema.parse(value), action };
}

export interface SellerAuctionState {
  status: string;
  deletedAt: Date | null;
  soldAt: Date | null;
  checkoutLockedAt: Date | null;
  startAt: Date;
  endAt: Date;
  currentBid: bigint;
  currentBidderUuid: string | null;
  bidCount: number;
  hasPurchase: boolean;
}
export function sellerAuctionEditable(row: SellerAuctionState, now: Date): boolean {
  return (
    row.status === 'visible' &&
    !row.deletedAt &&
    !row.soldAt &&
    !row.checkoutLockedAt &&
    row.startAt > now &&
    row.endAt > now &&
    row.currentBid === 0n &&
    row.currentBidderUuid === null &&
    row.bidCount === 0 &&
    !row.hasPurchase
  );
}
export function sellerAuctionStatus(row: Pick<SellerAuctionState, 'status' | 'startAt' | 'endAt'>, now: Date) {
  if (row.status === 'hidden' || row.status === 'cancelled') return row.status;
  return row.endAt <= now ? 'ended' : row.startAt > now ? 'waiting' : 'active';
}
