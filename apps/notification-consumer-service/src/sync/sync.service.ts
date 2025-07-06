import { PubSubService } from '@app/common/redis/pubsub.service';
import { RedisService } from '@app/common/redis/redis.service';
import { SseMessage } from '@app/common/schema/sse.schema';
import { Injectable } from '@nestjs/common';
import { CommonMessageValue } from '../../../../libs/common/src/schema/common-message.schema';
import { NotificationRepository } from '../notification/notification.repository';
import * as F from 'fp-ts/function';
import * as A from 'fp-ts/Array';

@Injectable()
export class SyncService {
  constructor(
    private readonly pubSubService: PubSubService,
    private readonly redisService: RedisService,
    private readonly notificationRepository: NotificationRepository,
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

  sendCommonMessage = async (values: CommonMessageValue[]) => {
    await Promise.all(
      values.map((value) =>
        Promise.all(
          value.memberUuids.map(async (memberUuid) => {
            const servers = await this.redisService.smembers(`user:${memberUuid}:servers`);
            const payload: SseMessage = {
              memberUuid,
              data: JSON.stringify({
                type: value.type,
                message: value.message,
                data: value.data,
              }),
            };
            await Promise.all(servers.map((server) => this.pubSubService.publish(server, JSON.stringify(payload))));
          }),
        ),
      ),
    );
  };

  createNotification = async (values: CommonMessageValue[]) => {
    const datas = F.pipe(
      values,
      A.flatMap((value) =>
        F.pipe(
          value.memberUuids,
          A.map((memberUuid) => ({
            memberUuid,
            message: value.message,
            data: value.data,
            type: value.type,
          })),
        ),
      ),
    );

    await this.notificationRepository.createBulk(datas);
  };
}
