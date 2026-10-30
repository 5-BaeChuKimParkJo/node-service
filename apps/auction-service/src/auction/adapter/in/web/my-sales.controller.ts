import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { z } from 'zod';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import type { User } from '@app/common/types/user';
import { MySalesService } from '../../../application/service/my-sales.service';

const querySchema = z
  .object({
    q: z.string().trim().max(80).default(''),
    status: z.enum(['all', 'waiting', 'active', 'ended', 'hidden', 'cancelled']).default('all'),
    sort: z.enum(['recent', 'ending', 'price']).default('recent'),
    page: z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .transform(Number)
      .refine((n) => n <= 10000)
      .default('1'),
  })
  .strict();

@Controller({ path: 'auctions', version: '1' })
export class MySalesController {
  constructor(private readonly sales: MySalesService) {}

  @Get('mine')
  @Header('Cache-Control', 'private, no-store')
  list(@JwtUser() user: User, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException('Invalid seller auction query');
    return this.sales.list(user.memberUuid, parsed.data);
  }
}
