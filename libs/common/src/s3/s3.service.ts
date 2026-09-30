import { HttpStatus, Injectable } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { CheckFileExistsArgs, GeneratePresignedUrlArgs } from './s3.types';
import { ErrorCode, AppException } from '../common';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService<EnvSchema>) {
    this.s3 = new S3Client({
      region: this.configService.getOrThrow('AWS_REGION', { infer: true }),
      credentials: {
        accessKeyId: this.configService.getOrThrow('AWS_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: this.configService.getOrThrow('AWS_SECRET_ACCESS_KEY', { infer: true }),
      },
      endpoint: this.configService.get('S3_ENDPOINT', { infer: true }) || undefined,
      forcePathStyle: this.configService.get('S3_FORCE_PATH_STYLE', { infer: true }) === 'true',
    });
    this.bucket = this.configService.getOrThrow('AWS_S3_BUCKET_NAME', { infer: true });
  }

  generatePresignedPostUrl = async ({
    key,
    contentType,
    maxSizeInBytes = 20 * 1024 * 1024, // default 20MB
    expiresIn = 3600, // default 1 hour
  }: GeneratePresignedUrlArgs): Promise<PresignedPost> => {
    const result = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 0, maxSizeInBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: {
        'Content-Type': contentType,
      },
      Expires: expiresIn,
    });

    return result;
  };

  checkFileExists = async ({ key }: CheckFileExistsArgs): Promise<void> => {
    try {
      if (key.startsWith('http')) {
        return;
      }
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e) {
      throw new AppException(
        { code: ErrorCode.FILE_NOT_FOUND, message: '파일이 존재하지 않습니다' },
        HttpStatus.NOT_FOUND,
      );
    }
  };

  putObject = async ({ key, contentType, body }: { key: string; contentType: string; body: Buffer }): Promise<void> => {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, Body: body }));
  };

  getObject = async (key: string): Promise<{ contentType: string; body: Buffer }> => {
    const result = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) {
      throw new AppException(
        { code: ErrorCode.FILE_NOT_FOUND, message: '파일이 존재하지 않습니다' },
        HttpStatus.NOT_FOUND,
      );
    }
    const bytes = await result.Body.transformToByteArray();
    return { contentType: result.ContentType ?? 'application/octet-stream', body: Buffer.from(bytes) };
  };

  toFullUrl = (key: string): string => {
    if (key.startsWith('http')) {
      return key;
    }
    const publicBaseUrl = this.configService.get('S3_PUBLIC_BASE_URL', { infer: true });
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(key)}`;
    }
    const region = this.configService.getOrThrow('AWS_REGION', { infer: true });
    const bucket = this.bucket;

    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  };
}
