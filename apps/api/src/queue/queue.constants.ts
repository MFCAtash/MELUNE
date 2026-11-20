/**
 * Shared between the producer side (StorageService, running inside the
 * main Nest API process) and the consumer side (the standalone worker in
 * `./workers/audio-transcode.worker.ts`, running in its own ffmpeg-capable
 * container — see infra/docker/worker.Dockerfile). Kept dependency-free
 * (no Nest imports) so the worker script can import it without pulling in
 * the whole Nest module graph.
 */

/** BullMQ queue name — must match on both the producer and the worker. */
export const AUDIO_TRANSCODE_QUEUE_NAME = "audio-transcode";

/** Job name used for every job added to the queue above. */
export const AUDIO_TRANSCODE_JOB_NAME = "transcode";

/** DI token for the BullMQ `Queue` producer, provided by QueueModule. */
export const AUDIO_TRANSCODE_QUEUE = Symbol("AUDIO_TRANSCODE_QUEUE");

/** The three constant-bitrate renditions produced for every HLS playlist. */
export const HLS_AUDIO_BITRATES_KBPS = [128, 192, 320] as const;

export interface AudioTranscodeJobData {
  /** Song row to update with the resulting playlist URL once done. */
  songId: string;
  /** Bucket key of the original uploaded audio file (e.g.
   *  "audio/<userId>/<uuid>.mp3"), as returned by
   *  StorageService.keyFromPublicUrl. */
  sourceKey: string;
}
