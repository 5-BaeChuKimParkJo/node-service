import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

describe('S3Service MinIO compatibility', () => {
  const config = {
    AWS_ACCESS_KEY_ID: 'fixture-access',
    AWS_SECRET_ACCESS_KEY: 'fixture-secret',
    AWS_REGION: 'us-east-1',
    AWS_S3_BUCKET_NAME: 'chalnak-test',
    S3_ENDPOINT: 'http://127.0.0.1:19000',
    S3_FORCE_PATH_STYLE: 'true',
    S3_PUBLIC_BASE_URL: '/auction-service/api/v1/auction-images',
  };

  it('signs a constrained POST against the configured MinIO endpoint without network access', async () => {
    const service = new S3Service(new ConfigService(config));
    const before = Date.now();
    const result = await service.generatePresignedPostUrl({
      key: 'auction/fixture.png',
      contentType: 'image/png',
      maxSizeInBytes: 2048,
      expiresIn: 120,
    });
    expect(result.url).toBe('http://127.0.0.1:19000/chalnak-test');
    expect(result.fields).toMatchObject({
      key: 'auction/fixture.png',
      'Content-Type': 'image/png',
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': expect.stringMatching(/^fixture-access\/\d{8}\/us-east-1\/s3\/aws4_request$/),
      'X-Amz-Signature': expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const policy = JSON.parse(Buffer.from(result.fields.Policy, 'base64').toString('utf8'));
    expect(policy.conditions).toEqual(
      expect.arrayContaining([
        ['content-length-range', 0, 2048],
        ['eq', '$Content-Type', 'image/png'],
        { bucket: 'chalnak-test' },
        { key: 'auction/fixture.png' },
      ]),
    );
    expect(Date.parse(policy.expiration)).toBeGreaterThanOrEqual(before + 119000);
    expect(Date.parse(policy.expiration)).toBeLessThanOrEqual(Date.now() + 120000);
  });

  it('keeps browser media behind the existing application proxy rather than the signing endpoint', () => {
    const service = new S3Service(new ConfigService(config));
    expect(service.toFullUrl('auction/fixture image.png')).toBe(
      '/auction-service/api/v1/auction-images/auction%2Ffixture%20image.png',
    );
  });
});
