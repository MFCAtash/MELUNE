import { Body, Controller, ForbiddenException, Post } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/authenticated-user";

/**
 * Direct-to-bucket uploads: the API never proxies the actual file bytes
 * (audio files especially would be a poor fit for a single Node process
 * to stream through). Instead it hands back a short-lived presigned PUT
 * URL; the client uploads straight to S3-compatible storage, then sends
 * the returned `publicUrl` as `audioUrl`/`coverUrl`/`avatarUrl` to the
 * normal songs/albums/users endpoints, which already only need a URL.
 */
@Controller("uploads")
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post("presign")
  async presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadUrlDto) {
    if (!this.storage.canUploadKind(dto.kind, user.role)) {
      throw new ForbiddenException(`Only artists can upload "${dto.kind}" files`);
    }

    return this.storage.createUploadUrl(
      dto.kind,
      user.id,
      dto.filename,
      dto.contentType,
      dto.sizeBytes,
    );
  }
}
