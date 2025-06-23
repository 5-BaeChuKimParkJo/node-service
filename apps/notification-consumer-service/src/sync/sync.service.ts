import { PubSubService } from '@app/common/redis/pubsub.service';
import { RedisService } from '@app/common/redis/redis.service';
import { SseMessage } from '@app/common/schema/sse.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SyncService {
  constructor(
    private readonly pubSubService: PubSubService,
    private readonly redisService: RedisService,
  ) {}

  chatroomSummaryReadUpdate = async (chatRoomUuid: string, memberUuids: string[]) => {
    await Promise.all(
      memberUuids.map(async (memberUuid) => {
        const servers = await this.redisService.smembers(`user:${memberUuid}:servers`);
        const payload: SseMessage = {
          memberUuid,
          data: JSON.stringify({
            type: 'READ_UPDATE',
            chatRoomUuid,
          }),
        };
        await Promise.all(servers.map((server) => this.pubSubService.publish(server, JSON.stringify(payload))));
      }),
    );
  };

  chatroomSummaryMessageUpdate = async (chatRoomUuid: string, memberUuids: string[]) => {
    await Promise.all(
      memberUuids.map(async (memberUuid) => {
        const servers = await this.redisService.smembers(`user:${memberUuid}:servers`);
        const payload: SseMessage = {
          memberUuid,
          data: JSON.stringify({
            type: 'MESSAGE_UPDATE',
            chatRoomUuid,
          }),
        };
        await Promise.all(servers.map((server) => this.pubSubService.publish(server, JSON.stringify(payload))));
      }),
    );
  };
}
