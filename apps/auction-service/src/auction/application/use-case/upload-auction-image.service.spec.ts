import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { UploadAuctionImageService } from './upload-auction-image.service';

describe('UploadAuctionImageService', () => {
  const user = { memberUuid: 'e3edec89-224d-4d6a-8c55-347232da34c2' } as never;

  it('stores an allowed image under a generated owner-scoped key', async () => {
    const storage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      toFullUrl: vi.fn((key: string) => `/auction-service/api/v1/auction-images/${key}`),
    } as unknown as AuctionFileStoragePort;
    const service = new UploadAuctionImageService(storage);

    const result = await service.execute(
      { contentType: 'image/webp', bytes: Buffer.from('524946460000000057454250', 'hex') },
      user,
    );

    expect(result.key).toMatch(new RegExp(`^${user.memberUuid}_[0-9a-f-]{36}\\.webp$`));
    expect(storage.putObject).toHaveBeenCalledWith({
      key: result.key,
      contentType: 'image/webp',
      body: expect.any(Buffer),
    });
    expect(result.url).toBe(`/auction-service/api/v1/auction-images/${result.key}`);
  });

  it('rejects bytes whose signature does not match the declared image type', async () => {
    const service = new UploadAuctionImageService({} as AuctionFileStoragePort);
    await expect(
      service.execute({ contentType: 'image/png', bytes: Buffer.from('not-an-image') }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['image/bmp', 'application/octet-stream', 'text/html'])('rejects unsupported content type %s', async (contentType) => {
    const service = new UploadAuctionImageService({} as AuctionFileStoragePort);

    await expect(service.execute({ contentType, bytes: Buffer.from('x') }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects files larger than five megabytes', async () => {
    const service = new UploadAuctionImageService({} as AuctionFileStoragePort);

    await expect(
      service.execute({ contentType: 'image/jpeg', bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
