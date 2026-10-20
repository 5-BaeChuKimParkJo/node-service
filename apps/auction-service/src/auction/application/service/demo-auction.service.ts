import { AppException } from '@app/common/common/app.exception';
import { ErrorCode } from '@app/common/common/const';
import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { DemoAuctionResult } from '../model/demo-auction.result';
import { CreateAuctionUseCase } from '../port/in/create-auction.use-case';
import { AuctionRepositoryPort } from '../port/out/auction-repository.port';

const demoLabel = /^\[DEMO(?:-\d+)?\]\s*/;

export class DemoAuctionService {
  constructor(
    private readonly repository: AuctionRepositoryPort,
    private readonly creator: CreateAuctionUseCase,
    private readonly templateUuid: string,
  ) {}

  async create(now = new Date()): Promise<DemoAuctionResult> {
    if (!z.string().uuid().safeParse(this.templateUuid).success) {
      throw new AppException(
        { message: '데모 경매 템플릿이 설정되지 않았습니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const template = (
      await this.repository.findAuction({ type: 'admin', auctionUuid: this.templateUuid })
    ).getSnapshot();
    if (!demoLabel.test(template.title) || template.status !== 'visible' || template.deletedAt) {
      throw new AppException(
        { message: '사용 가능한 데모 경매 템플릿이 아닙니다.', code: ErrorCode.VALIDATION_ERROR },
        HttpStatus.CONFLICT,
      );
    }
    const startAt = new Date(now);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
    const result = await this.creator.execute(
      {
        title: `[DEMO] ${template.title.replace(demoLabel, '').trim()}`.slice(0, 100),
        description:
          `포트폴리오 체험용 경매입니다. 실제 상품의 배송이나 거래는 제공하지 않습니다.\n\n${template.description}`.slice(
            0,
            1000,
          ),
        categoryId: template.categoryId,
        tagIds: [...template.tagIds],
        minimumBid: 1000n,
        startAt,
        endAt,
        isDirectDeal: false,
        directDealLocation: null,
        productCondition: template.productCondition,
        thumbnailKey: template.thumbnailKey,
        images: template.images.map(({ key, order }) => ({ key, order })),
      },
      { memberUuid: template.sellerUuid, role: 'member' },
    );
    return {
      auctionUuid: result.auctionUuid,
      title: result.title,
      startAt: result.startAt.toISOString(),
      endAt: result.endAt.toISOString(),
    };
  }
}
