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
import { PaymentAdminController } from './adapter/in/web/payment-admin.controller';
import { PaymentAdminService } from './application/service/payment-admin.service';
import { PaymentAdminQueryPort } from './application/port/out/payment-admin-query.port';
import { PaymentAdminPrismaAdapter } from './adapter/out/persistence/payment-admin-prisma.adapter';
import { PaymentAdminSummaryService } from './application/service/payment-admin-summary.service';
import { PaymentAdminSummaryPort } from './application/port/out/payment-admin-summary.port';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentController, AdminPaymentController, TossWebhookController, PaymentAdminController],
  providers: [
    PaymentService,
    PaymentAdminService,
    PaymentAdminPrismaAdapter,
    PaymentAdminSummaryService,
    { provide: PaymentAdminQueryPort, useExisting: PaymentAdminPrismaAdapter },
    { provide: PaymentAdminSummaryPort, useExisting: PaymentAdminPrismaAdapter },
    { provide: PaymentProviderPort, useClass: TossPaymentAdapter },
    InternalAdminTokenGuard,
    { provide: PaymentStorePort, useClass: PaymentPrismaAdapter },
  ],
})
export class PaymentModule {}
