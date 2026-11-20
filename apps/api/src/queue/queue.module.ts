import { Global, Logger, Module, OnApplicationShutdown, Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { AUDIO_TRANSCODE_QUEUE, AUDIO_TRANSCODE_QUEUE_NAME } from "./queue.constants";

const audioTranscodeQueueProvider: Provider = {
  provide: AUDIO_TRANSCODE_QUEUE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const logger = new Logger("AudioTranscodeQueue");
    const url = config.get<string>("REDIS_URL", "redis://localhost:6379");

    // BullMQ manages blocking calls itself and requires
    // `maxRetriesPerRequest: null` on the connection it's given — a
    // different tuning than RedisModule's ioredis client (which is
    // built for fast-failing cache get/set, see CacheService). Rather
    // than reuse that client, this queue gets its own dedicated
    // connection, same Redis instance.
    const connection = new Redis(url, { maxRetriesPerRequest: null });
    connection.on("error", (err) => logger.warn(`Redis connection error: ${err.message}`));

    return new Queue(AUDIO_TRANSCODE_QUEUE_NAME, { connection });
  },
};

/**
 * Producer-only: the API process enqueues audio-transcode jobs here but
 * never processes them — that happens in a separate worker process (see
 * ./workers/audio-transcode.worker.ts) so the API container never needs
 * ffmpeg installed. See docs/architecture.md.
 */
@Global()
@Module({
  providers: [audioTranscodeQueueProvider],
  exports: [AUDIO_TRANSCODE_QUEUE],
})
export class QueueModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    // Individual client/queue shutdown is handled by Nest's DI teardown
    // order, same rationale as RedisModule.
  }
}
