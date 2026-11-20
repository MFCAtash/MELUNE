import { Type } from "class-transformer";
import { IsObject, IsOptional, IsString, ValidateNested } from "class-validator";

/** Mirrors the browser's `PushSubscription.toJSON().keys` shape exactly. */
class PushKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

/**
 * Body the client sends after `pushManager.subscribe(...)` resolves —
 * i.e. `JSON.stringify(subscription)` from the browser, unmodified.
 */
export class SubscribePushDto {
  @IsString()
  endpoint: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class UnsubscribePushDto {
  @IsString()
  endpoint: string;
}
