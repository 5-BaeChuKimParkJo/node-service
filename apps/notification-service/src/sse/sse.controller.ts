import { User } from '@app/common';
import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { SseService } from './sse.service';
import * as jwt from 'jsonwebtoken';

@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get()
  async sse(@Query('token') token: string, @Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const user = jwt.decode(token) as User;
    await this.sseService.subscribe(user.memberUuid, req, reply);
    return reply;
  }
}
