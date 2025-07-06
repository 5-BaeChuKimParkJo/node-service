import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { Consumer, ConsumerConfig, Kafka } from 'kafkajs';
import { KafkaJS } from '@confluentinc/kafka-javascript';
import { CommonMessageValue } from '@app/common/schema/common-message.schema';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly confluentKafka: KafkaJS.Kafka;
  private readonly kafkajs: Kafka;
  private readonly producerTx: KafkaJS.Producer;
  private readonly producerTxLazy: KafkaJS.Producer;

  constructor(private readonly configService: ConfigService<EnvSchema>) {
    this.confluentKafka = new KafkaJS.Kafka({
      'bootstrap.servers': this.configService.getOrThrow('KAFKA_SERVERS', { infer: true }),
    });
    this.kafkajs = new Kafka({
      brokers: this.configService.getOrThrow('KAFKA_SERVERS', { infer: true }).split(','),
    });
    this.producerTx = this.confluentKafka.producer({
      'linger.ms': 10,
      acks: -1,
    });
    this.producerTxLazy = this.confluentKafka.producer({
      'linger.ms': 500,
      'batch.size': 3 * 1024 * 1024,
      acks: -1,
    });
  }

  onModuleInit = async () => {
    await this.producerTx.connect();
    await this.producerTxLazy.connect();
  };

  onModuleDestroy = async () => {
    await this.producerTx.disconnect();
    await this.producerTxLazy.disconnect();
  };

  send = async (producerRecord: KafkaJS.ProducerRecord & { bulk?: boolean }): Promise<KafkaJS.RecordMetadata[]> => {
    if (producerRecord.bulk) {
      return await this.producerTxLazy.send(producerRecord);
    } else {
      return await this.producerTx.send(producerRecord);
    }
  };

  sendCommonMessage = async (
    message: {
      key: string;
      value: CommonMessageValue;
    }[],
  ): Promise<KafkaJS.RecordMetadata[]> => {
    return await this.producerTx.send({
      topic: 'notification-consumer-service.common-message',
      messages: message.map(({ key, value }) => ({
        key,
        value: JSON.stringify(value),
      })),
    });
  };

  consumer = (consumerConfig: ConsumerConfig): Consumer => {
    return this.kafkajs.consumer(consumerConfig);
  };
}
