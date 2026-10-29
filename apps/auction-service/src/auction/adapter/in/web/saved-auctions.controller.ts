import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import type { User } from '@app/common/types/user';
import { SavedAuctionService } from '../../../application/service/saved-auction.service';

const emptyBody = z.object({}).strict();
const listQuery = z
  .object({
    cursor: z
      .string()
      .refine((value) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n)
      .optional(),
  })
  .strict();

@Controller({ path: 'auctions', version: '1' })
export class SavedAuctionsController {
  constructor(private readonly saved: SavedAuctionService) {}

  @Get('saved')
  @Header('Cache-Control', 'private, no-store')
  list(@JwtUser() user: User, @Query() query: unknown) {
    return this.saved.list(user.memberUuid, listQuery.parse(query).cursor ?? null);
  }

  @Get(':uuid/saved')
  @Header('Cache-Control', 'private, no-store')
  state(@JwtUser() user: User, @Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.saved.state(user.memberUuid, uuid);
  }

  @Put(':uuid/saved')
  @Header('Cache-Control', 'private, no-store')
  save(@JwtUser() user: User, @Param('uuid', new ParseUUIDPipe()) uuid: string, @Body() body: unknown) {
    emptyBody.parse(body ?? {});
    return this.saved.save(user.memberUuid, uuid);
  }

  @Delete(':uuid/saved')
  @Header('Cache-Control', 'private, no-store')
  remove(@JwtUser() user: User, @Param('uuid', new ParseUUIDPipe()) uuid: string, @Body() body: unknown) {
    emptyBody.parse(body ?? {});
    return this.saved.remove(user.memberUuid, uuid);
  }
}
