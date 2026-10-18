import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtUser } from '@app/common/decorator/jwt-user.decorator';
import type { User } from '@app/common/types/user';
import { InternalAdminTokenGuard } from '../../../../auction/adapter/in/web/internal-admin-token.guard';
import { PaymentService } from '../../../application/service/payment.service';

const emptyBody = z.object({}).strict();
const confirmBody = z
  .object({
    orderId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
    paymentKey: z.string().min(1).max(200),
    amount: z.string().regex(/^[1-9]\d{0,15}$/),
  })
  .strict();
const cancelBody = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const actorHeader = z.string().trim().min(1).max(200);

@Controller({ path: 'auctions/:uuid/checkout', version: '1' })
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  get(@Param('uuid', new ParseUUIDPipe()) uuid: string, @JwtUser() user: User) {
    return this.payments.get(uuid, user.memberUuid);
  }

  @Post()
  @HttpCode(200)
  prepare(@Param('uuid', new ParseUUIDPipe()) uuid: string, @JwtUser() user: User, @Body() body: unknown) {
    emptyBody.parse(body ?? {});
    return this.payments.prepare(uuid, user.memberUuid);
  }

  @Post('confirm')
  @HttpCode(200)
  confirm(@Param('uuid', new ParseUUIDPipe()) uuid: string, @JwtUser() user: User, @Body() body: unknown) {
    return this.payments.confirm(uuid, user.memberUuid, confirmBody.parse(body));
  }

  @Post('reconcile')
  @HttpCode(200)
  reconcile(@Param('uuid', new ParseUUIDPipe()) uuid: string, @JwtUser() user: User, @Body() body: unknown) {
    emptyBody.parse(body ?? {});
    return this.payments.reconcile(uuid, user.memberUuid);
  }
}

@Controller({ path: 'internal/admin/auctions/:uuid/payment', version: '1' })
@UseGuards(InternalAdminTokenGuard)
export class AdminPaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Get()
  get(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    return this.payments.get(uuid);
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Headers('x-admin-actor') actor: unknown,
    @Body() body: unknown,
  ) {
    return this.payments.cancel(uuid, actorHeader.parse(actor), cancelBody.parse(body).reason);
  }

  @Post('reconcile')
  @HttpCode(200)
  reconcile(
    @Param('uuid', new ParseUUIDPipe()) uuid: string,
    @Headers('x-admin-actor') actor: unknown,
    @Body() body: unknown,
  ) {
    actorHeader.parse(actor);
    emptyBody.parse(body ?? {});
    return this.payments.reconcile(uuid);
  }
}

@Controller({ path: 'payments/toss/webhook', version: '1' })
export class TossWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  @HttpCode(200)
  webhook(@Body() body: unknown) {
    return this.payments.webhook(body);
  }
}
