import { z } from 'zod';
import { AuctionAdminListRequestDto, AuctionAdminActionRequestDto, AuctionAdminBidsRequestDto } from '../dto/auction-admin.dto';
import { AuctionsAdminCommand } from '../../../../application/port/dto/auctions-admin.command';
import { AuctionAdminActionCommand } from '../../../../application/use-case/auction-admin.service';
import { AuctionAdminBidsCommand } from '../../../../application/port/dto/auction-admin-bids.command';

const bidsSchema = z
  .object({
    auctionUuid: z.string().uuid(),
    createdAt: z.string().datetime({ offset: true }).optional(),
    auctionBidderUuid: z.string().uuid().optional(),
  })
  .refine((value) => (value.createdAt !== undefined) === (value.auctionBidderUuid !== undefined), {
    message: 'createdAt and auctionBidderUuid must be provided together.',
  });

const listSchema = z
  .object({
    query: z.string().trim().max(100).optional(),
    status: z.enum(['waiting', 'active', 'ended', 'hidden', 'cancelled']).optional(),
    createdAt: z.string().datetime().optional(),
    auctionUuid: z.string().uuid().optional(),
  })
  .refine((value) => Boolean(value.createdAt) === Boolean(value.auctionUuid), {
    message: 'createdAt과 auctionUuid는 함께 입력해야 합니다.',
  });

const actionSchema = z.object({
  auctionUuid: z.string().uuid(),
  actor: z.string().trim().min(1).max(100),
  action: z.enum(['hide', 'restore', 'force-end']),
  reason: z.string().trim().min(1).max(500),
});

export class AuctionAdminDtoMapper {
  static toBidsCommand(auctionUuid: string, dto: AuctionAdminBidsRequestDto): AuctionAdminBidsCommand {
    const parsed = bidsSchema.parse({ ...dto, auctionUuid });
    return {
      auctionUuid: parsed.auctionUuid,
      cursor: parsed.createdAt && parsed.auctionBidderUuid
        ? { createdAt: parsed.createdAt, auctionBidderUuid: parsed.auctionBidderUuid }
        : undefined,
    };
  }

  static toListCommand(dto: AuctionAdminListRequestDto): AuctionsAdminCommand {
    const parsed = listSchema.parse(dto);
    return {
      type: 'admin',
      query: parsed.query || undefined,
      status: parsed.status,
      cursor: parsed.createdAt && parsed.auctionUuid
        ? { createdAt: new Date(parsed.createdAt), auctionUuid: parsed.auctionUuid }
        : undefined,
    };
  }

  static toActionCommand(
    auctionUuid: string,
    actor: string,
    dto: AuctionAdminActionRequestDto,
  ): AuctionAdminActionCommand {
    return actionSchema.parse({ auctionUuid, actor, ...dto });
  }
}
