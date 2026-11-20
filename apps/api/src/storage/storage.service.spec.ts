import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Queue } from "bullmq";

const sendMock = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "PutObjectCommand", input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ __type: "DeleteObjectCommand", input })),
  };
});

const getSignedUrlMock = jest.fn();
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

jest.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

import { StorageService } from "./storage.service";
import { UploadKind } from "./storage.constants";

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    STORAGE_ACCESS_KEY: "access-key",
    STORAGE_SECRET_KEY: "secret-key",
    STORAGE_BUCKET: "melune",
    STORAGE_PUBLIC_URL: "https://cdn.example.com/melune",
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
  } as unknown as ConfigService;
}

function makeQueueMock() {
  return { add: jest.fn().mockResolvedValue(undefined) } as unknown as Queue;
}

describe("StorageService", () => {
  beforeEach(() => {
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue("https://cdn.example.com/presigned-put-url");
  });

  describe("configuration", () => {
    it("reports unconfigured when access/secret keys are missing", () => {
      const service = new StorageService(makeConfig({ STORAGE_ACCESS_KEY: "", STORAGE_SECRET_KEY: "" }), makeQueueMock());
      expect(service.configured).toBe(false);
    });

    it("reports configured when both keys are present", () => {
      const service = new StorageService(makeConfig(), makeQueueMock());
      expect(service.configured).toBe(true);
    });
  });

  describe("canUploadKind", () => {
    let service: StorageService;
    beforeEach(() => {
      service = new StorageService(makeConfig(), makeQueueMock());
    });

    it("restricts AUDIO uploads to ARTIST/ADMIN", () => {
      expect(service.canUploadKind(UploadKind.AUDIO, "ARTIST")).toBe(true);
      expect(service.canUploadKind(UploadKind.AUDIO, "ADMIN")).toBe(true);
      expect(service.canUploadKind(UploadKind.AUDIO, "USER")).toBe(false);
    });

    it("restricts COVER uploads to ARTIST/ADMIN", () => {
      expect(service.canUploadKind(UploadKind.COVER, "USER")).toBe(false);
      expect(service.canUploadKind(UploadKind.COVER, "ARTIST")).toBe(true);
    });

    it("allows any authenticated role to upload an AVATAR", () => {
      expect(service.canUploadKind(UploadKind.AVATAR, "USER")).toBe(true);
      expect(service.canUploadKind(UploadKind.AVATAR, "ARTIST")).toBe(true);
    });
  });

  describe("createUploadUrl", () => {
    it("refuses to presign when storage isn't configured, before any validation", async () => {
      const service = new StorageService(makeConfig({ STORAGE_ACCESS_KEY: "", STORAGE_SECRET_KEY: "" }), makeQueueMock());

      await expect(
        service.createUploadUrl(UploadKind.AVATAR, "user-1", "pic.png", "image/png", 1024),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it("really rejects a contentType not on the kind's allow-list", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());

      await expect(
        service.createUploadUrl(UploadKind.AVATAR, "user-1", "clip.mp4", "video/mp4", 1024),
      ).rejects.toThrow(/contentType "video\/mp4" is not allowed for kind "avatar"/);
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it("accepts every contentType actually listed as allowed for the kind", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());

      await expect(
        service.createUploadUrl(UploadKind.COVER, "user-1", "cover.webp", "image/webp", 1024),
      ).resolves.toMatchObject({ uploadUrl: "https://cdn.example.com/presigned-put-url" });
    });

    it("really rejects a sizeBytes over the kind's maxSizeBytes", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());
      const tooBig = 6 * 1024 * 1024; // AVATAR max is 5MB

      await expect(
        service.createUploadUrl(UploadKind.AVATAR, "user-1", "pic.png", "image/png", tooBig),
      ).rejects.toThrow(/File is too large for kind "avatar"/);
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });

    it("accepts a sizeBytes exactly at the kind's maxSizeBytes boundary", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());
      const exactMax = 5 * 1024 * 1024; // AVATAR max is 5MB, boundary is inclusive (> check)

      await expect(
        service.createUploadUrl(UploadKind.AVATAR, "user-1", "pic.png", "image/png", exactMax),
      ).resolves.toMatchObject({ expiresInSeconds: 300 });
    });

    it("builds the object key from the kind's prefix, the owner id, and a fresh uuid", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());

      const result = await service.createUploadUrl(
        UploadKind.AUDIO,
        "user-42",
        "track.MP3",
        "audio/mpeg",
        2048,
      );

      expect(result.key).toBe("audio/user-42/fixed-uuid.mp3");
      expect(result.publicUrl).toBe("https://cdn.example.com/melune/audio/user-42/fixed-uuid.mp3");
    });

    it("falls back to a .bin extension when the filename has none matchable", async () => {
      const service = new StorageService(makeConfig(), makeQueueMock());

      const result = await service.createUploadUrl(
        UploadKind.AVATAR,
        "user-1",
        "noext",
        "image/png",
        1024,
      );

      expect(result.key).toBe("avatars/user-1/fixed-uuid.bin");
    });
  });

  describe("deleteObject", () => {
    it("is a no-op when storage isn't configured", async () => {
      const service = new StorageService(makeConfig({ STORAGE_ACCESS_KEY: "", STORAGE_SECRET_KEY: "" }), makeQueueMock());
      await service.deleteObject("audio/some-key.mp3");
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("sends a DeleteObjectCommand for the given key when configured", async () => {
      sendMock.mockResolvedValue({});
      const service = new StorageService(makeConfig(), makeQueueMock());

      await service.deleteObject("audio/some-key.mp3");

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ input: expect.objectContaining({ Key: "audio/some-key.mp3" }) }),
      );
    });

    it("swallows deletion errors rather than throwing (best-effort cleanup)", async () => {
      sendMock.mockRejectedValue(new Error("network blip"));
      const service = new StorageService(makeConfig(), makeQueueMock());

      await expect(service.deleteObject("audio/some-key.mp3")).resolves.toBeUndefined();
    });
  });

  describe("keyFromPublicUrl", () => {
    it("extracts the key when the URL matches our public base", () => {
      const service = new StorageService(makeConfig(), makeQueueMock());
      expect(service.keyFromPublicUrl("https://cdn.example.com/melune/audio/x.mp3")).toBe(
        "audio/x.mp3",
      );
    });

    it("returns undefined for a URL from somewhere else entirely", () => {
      const service = new StorageService(makeConfig(), makeQueueMock());
      expect(service.keyFromPublicUrl("https://someone-elses-cdn.com/audio/x.mp3")).toBeUndefined();
    });
  });

  describe("transcodeAudio", () => {
    it("is a no-op when storage isn't configured", async () => {
      const queue = makeQueueMock();
      const service = new StorageService(makeConfig({ STORAGE_ACCESS_KEY: "", STORAGE_SECRET_KEY: "" }), queue);

      await service.transcodeAudio("song-1", "audio/x.mp3");

      expect(queue.add).not.toHaveBeenCalled();
    });

    it("enqueues a job keyed by songId, so a second call for the same song replaces rather than duplicates it", async () => {
      const queue = makeQueueMock();
      const service = new StorageService(makeConfig(), queue);

      await service.transcodeAudio("song-1", "audio/x.mp3");

      expect(queue.add).toHaveBeenCalledWith(
        "transcode",
        { songId: "song-1", sourceKey: "audio/x.mp3" },
        expect.objectContaining({ jobId: "transcode:song-1" }),
      );
    });

    it("swallows queueing errors rather than throwing — HLS is a progressive enhancement", async () => {
      const queue = makeQueueMock();
      (queue.add as jest.Mock).mockRejectedValue(new Error("redis unreachable"));
      const service = new StorageService(makeConfig(), queue);

      await expect(service.transcodeAudio("song-1", "audio/x.mp3")).resolves.toBeUndefined();
    });
  });
});
