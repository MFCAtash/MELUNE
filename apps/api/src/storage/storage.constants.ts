export enum UploadKind {
  AUDIO = "audio",
  COVER = "cover",
  AVATAR = "avatar",
}

interface KindRules {
  /** Which roles may request a presigned URL for this kind. Empty = any authenticated user. */
  allowedContentTypes: string[];
  maxSizeBytes: number;
  /** Path prefix inside the bucket, e.g. "audio/<userId>/<uuid>.mp3". */
  prefix: string;
}

export const UPLOAD_RULES: Record<UploadKind, KindRules> = {
  [UploadKind.AUDIO]: {
    allowedContentTypes: [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/flac",
      "audio/mp4",
      "audio/ogg",
    ],
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    prefix: "audio",
  },
  [UploadKind.COVER]: {
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    prefix: "covers",
  },
  [UploadKind.AVATAR]: {
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024, // 5MB
    prefix: "avatars",
  },
};

/** Kinds that only ARTIST/ADMIN accounts may upload (catalog content, not personal profile media). */
export const RESTRICTED_KINDS = new Set([UploadKind.AUDIO, UploadKind.COVER]);
