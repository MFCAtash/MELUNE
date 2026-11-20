/**
 * Standalone worker process — deliberately NOT a Nest application.
 *
 * This is the only place in the whole stack that needs the `ffmpeg`
 * binary, so it runs in its own container (infra/docker/worker.Dockerfile)
 * built from a separate, ffmpeg-capable image; the main API container
 * never needs it. It talks to Postgres directly through `@prisma/client`
 * and to the bucket directly through `@aws-sdk/client-s3`, rather than
 * going through PrismaService/StorageService, because pulling in the
 * whole Nest module graph here would be a lot of dead weight for a
 * process that only ever does one thing: pop a job, run ffmpeg, upload
 * the result, update one row.
 *
 * Run with:
 *   node dist/queue/workers/audio-transcode.worker.js        (prod, after `nest build`)
 *   npm run start:worker:dev --workspace=apps/api            (dev, ts-node)
 */
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { pipeline } from "node:stream/promises";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  AUDIO_TRANSCODE_QUEUE_NAME,
  AudioTranscodeJobData,
  HLS_AUDIO_BITRATES_KBPS,
} from "../queue.constants";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Config — read directly from process.env, same variable names StorageService
// uses, since this process gets the same .env (see docker-compose.yml).
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT || undefined;
const STORAGE_REGION = process.env.STORAGE_REGION || "auto";
const STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY || "";
const STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY || "";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "codex-music";
const STORAGE_PUBLIC_URL =
  process.env.STORAGE_PUBLIC_URL ||
  (STORAGE_ENDPOINT
    ? `${STORAGE_ENDPOINT.replace(/\/$/, "")}/${STORAGE_BUCKET}`
    : `https://${STORAGE_BUCKET}.s3.amazonaws.com`);
// How many jobs this single worker process handles at once. ffmpeg is
// CPU-bound, so this only really matters if the container has multiple
// cores; kept modest so one runaway job can't starve the others.
const CONCURRENCY = Number(process.env.TRANSCODE_WORKER_CONCURRENCY ?? 2);

const s3 = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  forcePathStyle: true,
  credentials:
    STORAGE_ACCESS_KEY && STORAGE_SECRET_KEY
      ? { accessKeyId: STORAGE_ACCESS_KEY, secretAccessKey: STORAGE_SECRET_KEY }
      : undefined,
});

const prisma = new PrismaClient();

// A dedicated connection per BullMQ's requirement (maxRetriesPerRequest:
// null) — same reasoning as QueueModule on the producer side.
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

function log(level: "info" | "warn" | "error", msg: string) {
  // eslint-disable-next-line no-console
  console[level === "info" ? "log" : level](`[audio-transcode] ${msg}`);
}

/** Uploads every file under `dir` to the bucket under `keyPrefix`, preserving relative paths. */
async function uploadDirectory(dir: string, keyPrefix: string): Promise<void> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true } as never);
  for (const entry of entries as unknown as Array<{ name: string; parentPath?: string; path?: string; isFile: () => boolean }>) {
    if (!entry.isFile()) continue;
    // Node's `withFileTypes` + `recursive` combo reports `parentPath`
    // (Node 20.12+) or the older `path` alias — fall back to `dir` itself
    // so this keeps working across the point release this flipped in.
    const parentPath = entry.parentPath ?? entry.path ?? dir;
    const absolute = path.join(parentPath, entry.name);
    const relative = path.relative(dir, absolute).split(path.sep).join("/");
    const key = `${keyPrefix}/${relative}`;
    const body = await fs.readFile(absolute);

    await s3.send(
      new PutObjectCommand({
        Bucket: STORAGE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(relative),
      }),
    );
  }
}

function contentTypeFor(filename: string): string {
  if (filename.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (filename.endsWith(".ts")) return "video/mp2t";
  return "application/octet-stream";
}

/** Downloads the original audio object to a local temp file, returning its path. */
async function downloadSource(sourceKey: string, workDir: string): Promise<string> {
  const extension = path.extname(sourceKey) || ".bin";
  const localPath = path.join(workDir, `source${extension}`);

  const response = await s3.send(new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: sourceKey }));
  const body = response.Body;
  if (!body) throw new Error(`Empty response body fetching source object "${sourceKey}"`);

  await pipeline(body as NodeJS.ReadableStream, createWriteStream(localPath));
  return localPath;
}

/**
 * Runs ffmpeg once, producing one HLS rendition per entry in
 * HLS_AUDIO_BITRATES_KBPS plus a master playlist tying them together —
 * the standard `-var_stream_map` pattern for audio-only adaptive
 * bitrate (there's no video track to multiplex, so each rendition is
 * just an AAC-encoded copy of the same source at a different bitrate).
 */
async function runFfmpeg(sourcePath: string, outDir: string): Promise<void> {
  const names = HLS_AUDIO_BITRATES_KBPS.map((kbps) => `${kbps}k`);

  // ffmpeg's %v segment/playlist naming expects each named variant's
  // output directory to already exist.
  await Promise.all(names.map((name) => fs.mkdir(path.join(outDir, name), { recursive: true })));

  const args: string[] = ["-y", "-i", sourcePath];

  HLS_AUDIO_BITRATES_KBPS.forEach((kbps, i) => {
    args.push("-map", "0:a:0", `-c:a:${i}`, "aac", `-b:a:${i}`, `${kbps}k`, "-ac", "2");
  });

  args.push(
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_filename",
    path.join(outDir, "%v", "segment_%03d.ts"),
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    names.map((name, i) => `a:${i},name:${name}`).join(" "),
    path.join(outDir, "%v", "playlist.m3u8"),
  );

  try {
    await execFileAsync("ffmpeg", args, { maxBuffer: 1024 * 1024 * 32 });
  } catch (err) {
    // execFile rejects with stdout/stderr attached — surface stderr since
    // that's where ffmpeg actually explains itself (unsupported codec,
    // corrupt file, missing binary, ...).
    const stderr = (err as { stderr?: string }).stderr;
    throw new Error(`ffmpeg failed: ${stderr ?? (err as Error).message}`);
  }
}

async function processJob(job: Job<AudioTranscodeJobData>): Promise<void> {
  const { songId, sourceKey } = job.data;
  const workDir = path.join(os.tmpdir(), `transcode-${songId}-${randomUUID()}`);
  const outDir = path.join(workDir, "out");

  log("info", `song ${songId}: starting (source key "${sourceKey}")`);

  try {
    await fs.mkdir(outDir, { recursive: true });

    const sourcePath = await downloadSource(sourceKey, workDir);
    await runFfmpeg(sourcePath, outDir);

    const keyPrefix = `hls/${songId}`;
    await uploadDirectory(outDir, keyPrefix);

    const playlistUrl = `${STORAGE_PUBLIC_URL}/${keyPrefix}/master.m3u8`;

    // Best-effort existence check: a song can be deleted between the
    // job being queued and it running. Skip the write rather than error
    // the job (the uploaded HLS files are just orphaned bucket objects
    // in that case, no different from any other soft-deleted song's
    // still-present audioUrl object).
    const stillExists = await prisma.song.findUnique({ where: { id: songId }, select: { id: true } });
    if (stillExists) {
      await prisma.song.update({ where: { id: songId }, data: { hlsPlaylistUrl: playlistUrl } });
    }

    log("info", `song ${songId}: done → ${playlistUrl}`);
  } finally {
    // Always clean up the temp working directory, success or failure —
    // ffmpeg output for a several-minute track is easily tens of MB, and
    // this container has no other job cleaning /tmp.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

const worker = new Worker<AudioTranscodeJobData>(AUDIO_TRANSCODE_QUEUE_NAME, processJob, {
  connection,
  concurrency: CONCURRENCY,
});

worker.on("completed", (job) => log("info", `job ${job.id} completed`));
worker.on("failed", (job, err) => {
  // A failed transcode is never fatal to the product: Song.hlsPlaylistUrl
  // simply stays null (or keeps its previous value), and every player
  // keeps working directly off `audioUrl` — see PlayerEngine and
  // docs/architecture.md.
  log("error", `job ${job?.id ?? "?"} (song ${job?.data.songId ?? "?"}) failed: ${err.message}`);
});

log("info", `listening on queue "${AUDIO_TRANSCODE_QUEUE_NAME}" (concurrency=${CONCURRENCY})`);

async function shutdown() {
  log("info", "shutting down…");
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
