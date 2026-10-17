import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalAdminTokenGuard } from '../auction/adapter/in/web/internal-admin-token.guard';
import { AdminPaymentController, PaymentController, TossWebhookController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentStore, PrismaPaymentStore } from './payment.store';
import { TossProvider } from './toss.provider';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentController, AdminPaymentController, TossWebhookController],
  providers: [PaymentService, TossProvider, InternalAdminTokenGuard, { provide: PaymentStore, useClass: PrismaPaymentStore }],
})
export class PaymentModule {}
