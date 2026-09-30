import { BadRequestException, Controller, Get, Param, Post, Req, Res, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse } from '@nestjs/swagger';
import { JwtUser, User } from '@app/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { UploadAuctionImageUseCase } from '../../../application/port/in/upload-auction-image.use-case';
import { AuctionFileStoragePort } from '../../../application/port/out/auction-file-storage-port';

@Controller('auction-images')
export class AuctionMediaController {
  constructor(
    private readonly uploadAuctionImage: UploadAuctionImageUseCase,
    private readonly storage: AuctionFileStoragePort,
  ) {}

  @Version('1')
  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({ schema: { properties: { key: { type: 'string' }, url: { type: 'string' } } } })
  async upload(@Req() request: FastifyRequest, @JwtUser() user: User) {
    const file = await request.file({ limits: { files: 1, fileSize: 5 * 1024 * 1024 } });
    if (!file) {
      throw new BadRequestException('이미지 파일이 필요합니다.');
    }
    const bytes = await file.toBuffer();
    return this.uploadAuctionImage.execute({ contentType: file.mimetype, bytes }, user);
  }

  @Version('1')
  @Get(':key')
  async read(@Param('key') key: string, @Res() reply: FastifyReply) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) {
      throw new BadRequestException('유효하지 않은 이미지 키입니다.');
    }
    const object = await this.storage.getObject(key);
    return reply.header('Content-Type', object.contentType).header('Cache-Control', 'public, max-age=31536000, immutable').send(object.body);
  }
}
