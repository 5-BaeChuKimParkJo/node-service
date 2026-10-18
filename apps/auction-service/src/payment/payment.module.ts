import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { InternalAdminTokenGuard } from '../auction/adapter/in/web/internal-admin-token.guard';
import { AdminPaymentController, PaymentController, TossWebhookController } from './adapter/in/web/payment.controller';
import { PaymentService } from './application/service/payment.service';
import { PaymentStorePort } from './application/port/out/payment-store.port';
import { PaymentPrismaAdapter } from './adapter/out/persistence/payment-prisma.adapter';
import { PaymentProviderPort } from './application/port/out/payment-provider.port';
import { TossPaymentAdapter } from './adapter/out/http/toss-payment.adapter';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentController, AdminPaymentController, TossWebhookController],
  providers: [
    PaymentService,
    { provide: PaymentProviderPort, useClass: TossPaymentAdapter },
    InternalAdminTokenGuard,
    { provide: PaymentStorePort, useClass: PaymentPrismaAdapter },
  ],
})
export class PaymentModule {}
