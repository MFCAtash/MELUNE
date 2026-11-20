import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Queue } from "bullmq";
import { v4 as uuid } from "uuid";
import { UploadKind, UPLOAD_RULES, RESTRICTED_KINDS } from "./storage.constants";
import {
  AUDIO_TRANSCODE_JOB_NAME,
  AUDIO_TRANSCODE_QUEUE,
  AudioTranscodeJobData,
} from "../queue/queue.constants";

export interface PresignedUpload {
  /** PUT this URL directly from the browser/app with the exact contentType used to sign it. */
  uploadUrl: string;
  /** The permanent, publicly reachable URL to store on the Song/Album/User row once the upload succeeds. */
  publicUrl: string;
  /** Object key inside the bucket, useful for later deletion. */
  key: string;
  expiresInSeconds: number;
}

const PRESIGN_TTL_SECONDS = 300; // 5 minutes to complete the PUT

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  readonly configured: boolean;

  constructor(
    private readonly config: ConfigService,
    @Inject(AUDIO_TRANSCODE_QUEUE) private readonly audioTranscodeQueue: Queue,
  ) {
    const endpoint = this.config.get<string>("STORAGE_ENDPOINT") || undefined;
    const region = this.config.get<string>("STORAGE_REGION") || "auto";
    const accessKeyId = this.config.get<string>("STORAGE_ACCESS_KEY") || "";
    const secretAccessKey = this.config.get<string>("STORAGE_SECRET_KEY") || "";
    this.bucket = this.config.get<string>("STORAGE_BUCKET", "melune");

    this.configured = Boolean(accessKeyId && secretAccessKey);
    if (!this.configured) {
      this.logger.warn(
        "STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY are not set — upload endpoints will return 503 until storage is configured.",
      );
    }

    this.client = new S3Client({
      region,
      endpoint,
      // Path-style addressing is required by MinIO and most self-hosted
      // S3-compatible servers; real AWS S3 also accepts it, so it's safe
      // to always turn on rather than branch on provider.
      forcePathStyle: true,
      credentials: this.configured ? { accessKeyId, secretAccessKey } : undefined,
    });

    this.publicBaseUrl =
      this.config.get<string>("STORAGE_PUBLIC_URL") ||
      (endpoint ? `${endpoint.replace(/\/$/, "")}/${this.bucket}` : `https://${this.bucket}.s3.amazonaws.com`);
  }

  canUploadKind(kind: UploadKind, role: string): boolean {
    if (!RESTRICTED_KINDS.has(kind)) return true;
    return role === "ARTIST" || role === "ADMIN";
  }

  async createUploadUrl(
    kind: UploadKind,
    ownerId: string,
    filename: string,
    contentType: string,
    sizeBytes: number,
  ): Promise<PresignedUpload> {
    if (!this.configured) {
      throw new BadRequestException(
        "File storage is not configured on this server (missing STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY).",
      );
    }

    const rules = UPLOAD_RULES[kind];
    if (!rules.allowedContentTypes.includes(contentType)) {
      throw new BadRequestException(
        `contentType "${contentType}" is not allowed for kind "${kind}". Allowed: ${rules.allowedContentTypes.join(", ")}`,
      );
    }
    if (sizeBytes > rules.maxSizeBytes) {
      throw new BadRequestException(
        `File is too large for kind "${kind}" (max ${Math.floor(rules.maxSizeBytes / (1024 * 1024))}MB).`,
      );
    }

    const dot = filename.lastIndexOf(".");
    const extension = dot > 0 ? filename.slice(dot + 1).toLowerCase() : "bin";
    const key = `${rules.prefix}/${ownerId}/${uuid()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });

    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl}/${key}`,
      key,
      expiresInSeconds: PRESIGN_TTL_SECONDS,
    };
  }

  /**
   * Queues an async job (BullMQ, on the same Redis instance as
   * CacheService) that transcodes the original audio object at
   * `sourceKey` into a multi-bitrate HLS playlist (128k/192k/320k AAC +
   * .m3u8 playlists), uploaded back into this same bucket under
   * `hls/<songId>/`. The job is processed by a separate, ffmpeg-capable
   * worker process (apps/api/src/queue/workers/audio-transcode.worker.ts)
   * — never inline here — so a slow transcode can't block a request, and
   * the API container itself never needs ffmpeg installed.
   *
   * There's no presigned-upload webhook in this stack (the browser PUTs
   * straight to the bucket, bypassing the API entirely), so "after
   * upload" in practice means "once the API has a Song row pointing at
   * that upload" — this is called from SongsService right after
   * create/update persists a new `audioUrl`, which is the earliest
   * point the server can reliably tie an uploaded object to a song.
   *
   * Deliberately fire-and-forget and never throws: queuing (like the
   * transcode itself) is a progressive enhancement over the existing
   * direct-file playback, which must keep working unchanged if Redis is
   * down, ffmpeg fails, or anything else here goes wrong — see
   * `hlsPlaylistUrl` on the Song model and PlayerEngine's fallback.
   */
  async transcodeAudio(songId: string, sourceKey: string): Promise<void> {
    if (!this.configured) return;

    try {
      await this.audioTranscodeQueue.add(
        AUDIO_TRANSCODE_JOB_NAME,
        { songId, sourceKey } satisfies AudioTranscodeJobData,
        {
          // One pending/active transcode per song at a time — a second
          // upload before the first job finishes replaces it rather
          // than piling up duplicate work.
          jobId: `transcode:${songId}`,
          attempts: 2,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to queue HLS transcode for song "${songId}": ${(err as Error).message}`,
      );
    }
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.configured) return;
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.warn(`Failed to delete storage object "${key}": ${(err as Error).message}`);
    }
  }

  /** Best-effort: turns a public URL we generated back into its bucket key, or undefined if it wasn't ours. */
  keyFromPublicUrl(url: string): string | undefined {
    if (!url.startsWith(this.publicBaseUrl)) return undefined;
    return url.slice(this.publicBaseUrl.length + 1);
  }
}
