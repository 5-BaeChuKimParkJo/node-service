import { HttpStatus, Injectable } from '@nestjs/common';
import { ReadRepository } from './read.repository';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as NEA from 'fp-ts/NonEmptyArray';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import { ReadFn } from './read.fn';
import { AppException, ErrorCode, User } from '@app/common';
import * as Str from 'fp-ts/string';
import { Auction } from './schema/auction.schema';
import { Thumbnail } from './schema/thumbnail-schema';
import { KafkaService } from '@app/common/kafka/kafka.service';
import { Product } from './schema/product.schema';

@Injectable()
export class ReadService {
  constructor(
    private readonly readRepository: ReadRepository,
    private readonly fn: ReadFn,
  ) {}

  products = (productUuids: string[]): TE.TaskEither<AppException, Product[]> => {
    return F.pipe(
      this.readRepository.findProducts(productUuids),
      TE.flatMap((products) =>
        F.pipe(
          TE.Do,
          TE.let('products', () => products),
          TE.bind('saleMemberByUuid', ({ products }) =>
            F.pipe(
              products,
              A.map((auction) => auction.saleMemberUuid),
              A.uniq(Str.Eq),
              this.fn.fetchMembers,
              TE.map(NEA.groupBy(({ memberUuid }) => memberUuid)),
            ),
          ),
        ),
      ),
      TE.map(({ products, saleMemberByUuid }) =>
        F.pipe(
          products,
          A.map((auction) => ({ ...auction, seller: A.head(saleMemberByUuid[auction.saleMemberUuid]) })),
          A.filterMap((auction) =>
            O.isNone(auction.seller) ? O.none : O.some({ ...auction, seller: auction.seller.value }),
          ),
        ),
      ),
    );
  };

  auctions = (auctionUuids: string[]): TE.TaskEither<AppException, Auction[]> => {
    return F.pipe(
      this.readRepository.findAuctions(auctionUuids),
      TE.flatMap((auctions) =>
        F.pipe(
          TE.Do,
          TE.let('auctions', () => auctions),
          TE.bind('sellerByUuid', ({ auctions }) =>
            F.pipe(
              auctions,
              A.map((auction) => auction.sellerUuid),
              A.uniq(Str.Eq),
              this.fn.fetchMembers,
              TE.map(NEA.groupBy(({ memberUuid }) => memberUuid)),
            ),
          ),
        ),
      ),
      TE.map(({ auctions, sellerByUuid }) =>
        F.pipe(
          auctions,
          A.map((auction) => ({ ...auction, seller: A.head(sellerByUuid[auction.sellerUuid]) })),
          A.filterMap((auction) =>
            O.isNone(auction.seller) ? O.none : O.some({ ...auction, seller: auction.seller.value }),
          ),
        ),
      ),
    );
  };

  auction = (auctionUuid: string, user: User): TE.TaskEither<AppException, Auction> => {
    return F.pipe(
      this.auctions([auctionUuid]),
      TE.map(A.head),
      TE.flatMap(
        TE.fromOption(
          () =>
            new AppException(
              { code: ErrorCode.NOT_FOUND, message: '해당 경매를 찾을 수 없습니다.' },
              HttpStatus.NOT_FOUND,
            ),
        ),
      ),
      TE.map((auction) => {
        this.fn.sendAuctionViewed(auctionUuid, user);
        return auction;
      }),
    );
  };

  product = (productUuid: string, user: User): TE.TaskEither<AppException, Product> => {
    return F.pipe(
      this.products([productUuid]),
      TE.map(A.head),
      TE.flatMap(
        TE.fromOption(
          () =>
            new AppException(
              { code: ErrorCode.NOT_FOUND, message: '해당 상품을 찾을 수 없습니다.' },
              HttpStatus.NOT_FOUND,
            ),
        ),
      ),
      TE.map((product) => {
        this.fn.sendProductViewed(productUuid, user);
        return product;
      }),
    );
  };

  thumbnails = (ids: string[]): TE.TaskEither<AppException, Thumbnail[]> => {
    return this.readRepository.findThumbnails(ids);
  };

  usersAuctions = (memberUuid: string): TE.TaskEither<AppException, Omit<Auction, 'seller'>[]> => {
    return this.readRepository.findUsersAuctions(memberUuid);
  };
}
