import { Injectable, OnModuleInit } from '@nestjs/common';
import { U, User } from '@app/common';
import { AppException } from '@app/common/common/app.exception';
import * as TE from 'fp-ts/TaskEither';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as Rec from 'fp-ts/Record';
import * as Str from 'fp-ts/string';
import { AuctionEtcFn } from './auction-etc.fn';
import { MyBidsOutput } from './schema/my-bids.schema';
import { PrismaService } from '../prisma/prisma.service';
import { BidAuctionBatchInput } from './schema/bidder.schema';
import { AuctionEtcRepository } from './auction-etc.repository';

@Injectable()
export class AuctionEtcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auctionEtcRepository: AuctionEtcRepository,
    private readonly auctionEtcFn: AuctionEtcFn,
  ) {}

  getMyBids = (user: User): TE.TaskEither<AppException, MyBidsOutput[]> => {
    return F.pipe(
      TE.Do,
      TE.bind('bids', () => this.auctionEtcRepository.findMyBids(user)),
      TE.bind('auctionUuidByAutcionId', ({ bids }) =>
        F.pipe(
          bids,
          A.map((auction) => auction.auctionId),
          (auctionIds) => this.auctionEtcRepository.findAuctionUuids(auctionIds),
          TE.map(NEA.groupBy((row) => String(row.auctionId))),
          TE.map(Rec.map(NEA.head)),
          TE.map(Rec.map((auction) => auction.auctionUuid)),
        ),
      ),
      TE.bind('auctionByAuctionUuid', ({ auctionUuidByAutcionId }) =>
        F.pipe(
          auctionUuidByAutcionId,
          U.Rec.values,
          this.auctionEtcFn.fetchAuctions,
          TE.map(NEA.groupBy((auction) => auction.auctionUuid)),
          TE.map(Rec.map(NEA.head)),
        ),
      ),
      TE.map(({ bids, auctionByAuctionUuid, auctionUuidByAutcionId }) =>
        bids.map((bid) => ({
          bidder: bid,
          auction: auctionByAuctionUuid[auctionUuidByAutcionId[String(bid.auctionId)]],
        })),
      ),
      TE.map(A.filter((myBid) => !!myBid.auction)),
    );
  };

  bidAuctionBatch = async (input: BidAuctionBatchInput[]) => {
    if (input.length === 0) return;
    type Bidder = {
      bidderUuid: string;
      requestId: string;
      auctionUuid: string;
      type:
        | 'success'
        | 'rejected-period'
        | 'rejected-amount'
        | 'rejected-too-high-bid'
        | 'rejected-duplicate'
        | 'rejected-seller';
    };
    const now = new Date();
    const biddersWithStatus: Bidder[] = [];
    const maxBidders: { auctionUuid: string; bidderUuid: string; bidAmount: number }[] = [];
    await this.prisma.$transaction(async (tx) => {
      const auctionUuids = F.pipe(
        input,
        A.map((bidder) => bidder.auctionUuid),
        A.uniq(Str.Eq),
      );
      const auctions = await this.auctionEtcRepository.findAcutionsForUpdate(auctionUuids, tx);
      const biddersByAuctionUuid = F.pipe(
        input,
        NEA.groupBy((bidder) => bidder.auctionUuid),
      );

      for (const auction of auctions) {
        const bidders: BidAuctionBatchInput[] | undefined = biddersByAuctionUuid[auction.auctionUuid];
        if (!bidders) continue;

        // 입찰 가능한 기간이 아닌 경우
        if (!(auction.startAt <= now && now <= auction.endAt)) {
          for (const bidder of bidders) biddersWithStatus.push({ ...bidder, type: 'rejected-period' });
          continue;
        }

        let filteredBidders = bidders;

        // 자신의 경매에 입찰하는 경우
        const selfBidders = filteredBidders.filter((bidder) => bidder.bidderUuid === auction.sellerUuid);
        for (const bidder of selfBidders) biddersWithStatus.push({ ...bidder, type: 'rejected-seller' });
        filteredBidders = filteredBidders.filter((bidder) => bidder.bidderUuid !== auction.sellerUuid);

        // 가격 미달인 경우
        const minimumBid = Math.max(Number(auction.minimumBid) - 1, Number(auction.currentBid));
        const belowMinimumBidders = filteredBidders.filter((bidder) => bidder.bidAmount <= minimumBid);
        for (const bidder of belowMinimumBidders) biddersWithStatus.push({ ...bidder, type: 'rejected-amount' });
        filteredBidders = filteredBidders.filter((bidder) => bidder.bidAmount > minimumBid);

        if (filteredBidders.length === 0) continue;
        const simplifedBidders: BidAuctionBatchInput[] = [];
        filteredBidders = filteredBidders
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .sort((a, b) => a.bidAmount - b.bidAmount);
        let prevBidder: BidAuctionBatchInput | null = null;
        for (let i = 0; i < filteredBidders.length; i++) {
          const bidder = filteredBidders[i];
          if (prevBidder === null) {
            simplifedBidders.push(bidder);
          } else if (prevBidder.bidAmount === bidder.bidAmount) {
            biddersWithStatus.push({ ...bidder, type: 'rejected-amount' });
          } else if (prevBidder.bidderUuid === bidder.bidderUuid) {
            biddersWithStatus.push({ ...bidder, type: 'rejected-duplicate' });
          } else {
            simplifedBidders.push(bidder);
          }
          prevBidder = bidder;
        }
        filteredBidders = simplifedBidders;

        if (filteredBidders.length === 0) continue;
        if (auction.currentBidderUuid !== null && filteredBidders[0].bidderUuid === auction.currentBidderUuid) {
          biddersWithStatus.push({ ...filteredBidders[0], type: 'rejected-duplicate' });
          filteredBidders = filteredBidders.slice(1);
        }

        let stopFlag = false;
        let prevBid = minimumBid;
        let maxBidder: BidAuctionBatchInput | undefined;
        for (const bidder of filteredBidders) {
          if (prevBid * 1.3 < bidder.bidAmount) {
            stopFlag = true;
          }

          if (stopFlag) {
            biddersWithStatus.push({ ...bidder, type: 'rejected-too-high-bid' });
          } else {
            biddersWithStatus.push({ ...bidder, type: 'success' });
            maxBidder = bidder;
          }

          prevBid = bidder.bidAmount;
        }

        if (maxBidder) {
          maxBidders.push(maxBidder);
        }
      }

      if (maxBidders.length > 0) {
        // 최고 입찰자 업데이트
        await tx.$executeRawUnsafe(`
        UPDATE "Auctions"
        SET 
          "currentBid" = v.current_bid,
          "currentBidderUuid" = v.current_bidder_uuid 
        FROM (
          VALUES
            ${maxBidders
              .map((bidder) => `('${bidder.auctionUuid}'::uuid, ${bidder.bidAmount}, '${bidder.bidderUuid}'::uuid)`)
              .join(',')}
        ) AS v(id, current_bid, current_bidder_uuid)
        WHERE "auctionUuid" = v.id
      `);
      }
    });

    await this.auctionEtcFn.sendBidMessages(biddersWithStatus);
  };
}
