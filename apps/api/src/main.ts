import "reflect-metadata";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const config = app.get(ConfigService);

  // Production sits behind Caddy (and Cloudflare in front of it). Without
  // this, Express reports the Caddy container address as req.ip for every
  // visitor, which would collapse per-IP rate limiting into one shared
  // 100 req/min bucket. The custom throttler guard also prefers
  // CF-Connecting-IP when present.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cookieParser());
  // Comma-separated so one deployment can allow more than one origin (a
  // staging web app alongside production, say) without code changes —
  // validated by env.validation.ts's validateEnv, which checks each
  // entry is a real absolute URL before the server ever starts.
  const corsOrigins = config
    .get<string>("CORS_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix("api");

  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🎵 Codex Music API running on http://localhost:${port}/api`);
}

bootstrap();
