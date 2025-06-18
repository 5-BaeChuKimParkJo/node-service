import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvSchema } from '../common/env-schema';
import { Consumer, ConsumerConfig, Kafka, Producer, ProducerRecord, RecordMetadata } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  constructor(private readonly configService: ConfigService<EnvSchema>) {
    this.kafka = new Kafka({
      brokers: this.configService.getOrThrow('KAFKA_SERVERS', { infer: true }).split(','),
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
    });
  }

  onModuleInit = async () => {
    await this.producer.connect();
  };

  onModuleDestroy = async () => {
    await this.producer.disconnect();
  };

  send = async (producerRecord: ProducerRecord): Promise<RecordMetadata[]> => {
    return await this.producer.send(producerRecord);
  };

  consumer = (consumerConfig: ConsumerConfig): Consumer => {
    return this.kafka.consumer(consumerConfig);
  };
}
