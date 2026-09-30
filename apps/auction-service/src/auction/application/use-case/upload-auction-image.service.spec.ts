import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuctionFileStoragePort } from '../port/out/auction-file-storage-port';
import { UploadAuctionImageService } from './upload-auction-image.service';

describe('UploadAuctionImageService', () => {
  const user = { memberUuid: 'e3edec89-224d-4d6a-8c55-347232da34c2' } as never;

  it('stores an allowed image under a generated flat key', async () => {
    const storage = {
      putObject: vi.fn().mockResolvedValue(undefined),
      toFullUrl: vi.fn((key: string) => `/auction-service/api/v1/auction-images/${key}`),
    } as unknown as AuctionFileStoragePort;
    const service = new UploadAuctionImageService(storage);

    const result = await service.execute(
      { contentType: 'image/webp', bytes: Buffer.from('image') },
      user,
    );

    expect(result.key).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect(storage.putObject).toHaveBeenCalledWith({
      key: result.key,
      contentType: 'image/webp',
      body: expect.any(Buffer),
    });
    expect(result.url).toBe(`/auction-service/api/v1/auction-images/${result.key}`);
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
