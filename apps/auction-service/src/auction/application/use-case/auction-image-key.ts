import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';

const IMAGE_SUFFIX_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

export function createAuctionImageKey(memberUuid: string, extension: string): string {
  return `${memberUuid}_${randomUUID()}.${extension}`;
}

export function assertOwnedAuctionImageKey(key: string, memberUuid: string): void {
  const prefix = `${memberUuid}_`;
  if (!key.startsWith(prefix) || !IMAGE_SUFFIX_PATTERN.test(key.slice(prefix.length))) {
    throw new BadRequestException('본인이 업로드한 경매 이미지만 사용할 수 있습니다.');
  }
}

export function isAuctionImageKey(key: string): boolean {
  const separator = key.indexOf('_');
  return separator > 0 && IMAGE_SUFFIX_PATTERN.test(key.slice(separator + 1));
}
