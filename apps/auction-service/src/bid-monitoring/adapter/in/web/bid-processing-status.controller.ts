import { Controller, Get, Header, UseGuards, Version } from '@nestjs/common';
import { BidProcessingStatusService } from '../../../application/service/bid-processing-status.service';
import { InternalAdminTokenGuard } from '../../../../auction/adapter/in/web/internal-admin-token.guard';

@Controller('/internal/admin/bid-processing-status')
@UseGuards(InternalAdminTokenGuard)
export class BidProcessingStatusController {
  constructor(private readonly status: BidProcessingStatusService) {}
  @Get()
  @Version('1')
  @Header('Cache-Control', 'no-store')
  get() {
    return this.status.get();
  }
}
