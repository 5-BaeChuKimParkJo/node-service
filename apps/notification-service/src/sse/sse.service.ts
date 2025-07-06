import { PubSubService } from '@app/common/redis/pubsub.service';
import { RedisService } from '@app/common/redis/redis.service';
import { sseMessageSchema } from '@app/common/schema/sse.schema';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SseService implements OnModuleInit, OnModuleDestroy {
  private readonly PING_INTERVAL = 30 * 1000;
  private readonly serverName = uuidv4();
  private readonly connects: Map<string, Set<FastifyReply>> = new Map();
  private pingIntervalKey: NodeJS.Timeout | undefined = undefined;

  constructor(
    private readonly redisService: RedisService,
    private readonly pubSubService: PubSubService,
  ) {}

  onModuleInit = async () => {
    this.pingIntervalKey = setInterval(() => this.pingAll(), this.PING_INTERVAL);
    await this.subscribePubSub();
  };

  onModuleDestroy = () => {
    if (this.pingIntervalKey) clearInterval(this.pingIntervalKey);
  };

  subscribe = async (memberUuid: string, req: FastifyRequest, reply: FastifyReply) => {
    await this.connect(memberUuid, reply, req);
    req.raw.on('close', async () => {
      await this.disconnect(memberUuid, reply);
    });
  };

  private subscribePubSub = async () => {
    await this.pubSubService.subscribe(this.serverName, async (channel: string, message: string) => {
      const safeParsed = sseMessageSchema.safeParse(JSON.parse(message));
      if (!safeParsed.success) return;
      const sseMessage = safeParsed.data;
      const replies = this.connects.get(sseMessage.memberUuid);
      if (!replies) return;
      for (const reply of replies) {
        try {
          reply.raw.write(`event: message\n`);
          reply.raw.write(
            `data: ${typeof sseMessage.data === 'string' ? sseMessage.data : JSON.stringify(sseMessage.data)}\n\n`,
          );
        } catch (error) {
          console.error(`SSE write error for member ${sseMessage.memberUuid}:`, error);
          await this.disconnect(sseMessage.memberUuid, reply);
        }
      }
    });
  };

  private pingAll = async () => {
    const entries = this.connects.entries();
    for (const [memberUuid, replies] of entries) {
      if (!replies) continue;
      for (const reply of replies) {
        try {
          reply.raw.write(':\n\n');
        } catch (error) {
          console.error(`SSE ping error for member ${memberUuid}:`, error);
          await this.disconnect(memberUuid, reply);
        }
      }
    }
  };

  private connect = async (memberUuid: string, reply: FastifyReply, req: FastifyRequest) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'http://localhost:3000',
      'https://cabbage-secondhand.shop',
      'https://www.cabbage-secondhand.shop',
    ];

    if (!origin || !allowedOrigins.includes(origin)) {
      reply.status(403).send('Forbidden');
      return;
    }
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });
    reply.raw.write(':\n\n');
    if (!this.connects.has(memberUuid)) {
      this.connects.set(memberUuid, new Set());
    }
    await this.redisService.sadd(`user:${memberUuid}:servers`, this.serverName);
    this.connects.get(memberUuid)?.add(reply);
    console.log('connect', memberUuid);
  };

  private disconnect = async (memberUuid: string, reply: FastifyReply) => {
    const replies = this.connects.get(memberUuid);
    if (!replies) return;
    replies.delete(reply);
    await this.redisService.srem(`user:${memberUuid}:servers`, this.serverName);
    if (replies.size === 0) this.connects.delete(memberUuid);
    console.log('disconnect', memberUuid);
  };
}
