import { z } from 'zod';
import { AuctionAdminListRequestDto, AuctionAdminActionRequestDto } from '../dto/auction-admin.dto';
import { AuctionsAdminCommand } from '../../../../application/port/dto/auctions-admin.command';
import { AuctionAdminActionCommand } from '../../../../application/use-case/auction-admin.service';

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
