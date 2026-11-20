import { validateEnv } from "../env.validation";

const VALID = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/melune",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "a".repeat(32),
};

describe("validateEnv", () => {
  it("passes with only the required variables set, applying documented defaults", () => {
    const result = validateEnv({ ...VALID });
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
    expect(result.JWT_ACCESS_EXPIRES_IN).toBe("15m");
    expect(result.JWT_REFRESH_EXPIRES_IN).toBe("30d");
    expect(result.CORS_ORIGIN).toBe("http://localhost:3000");
  });

  it("throws one aggregated error listing every missing required variable at once", () => {
    expect.assertions(4);
    try {
      validateEnv({});
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain("DATABASE_URL");
      expect(message).toContain("REDIS_URL");
      expect(message).toContain("JWT_ACCESS_SECRET");
    }
    expect(() => validateEnv({})).toThrow();
  });

  it("rejects a blank JWT_ACCESS_SECRET — the exact bug this exists to catch", () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_SECRET: "" })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it("rejects a JWT_ACCESS_SECRET shorter than 32 characters", () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_SECRET: "too-short" })).toThrow(/32 characters/);
  });

  it("accepts a JWT_ACCESS_SECRET of exactly 32 characters", () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_SECRET: "a".repeat(32) })).not.toThrow();
  });

  it("rejects a DATABASE_URL that isn't a postgres connection string", () => {
    expect(() => validateEnv({ ...VALID, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a REDIS_URL missing the redis:// scheme", () => {
    expect(() => validateEnv({ ...VALID, REDIS_URL: "localhost:6379" })).toThrow(/REDIS_URL/);
  });

  it.each(["15", "15 m", "m15", "15mm"])(
    "rejects a malformed JWT_ACCESS_EXPIRES_IN (%s)",
    (bad) => {
      expect(() => validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: bad })).toThrow(
        /JWT_ACCESS_EXPIRES_IN/,
      );
    },
  );

  it('treats a blank JWT_ACCESS_EXPIRES_IN as "not set" (falls back to the default) rather than an error', () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: "" })).not.toThrow();
    expect(validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: "" }).JWT_ACCESS_EXPIRES_IN).toBe("15m");
  });

  it.each(["15s", "15m", "2h", "7d"])("accepts a well-formed expiry (%s)", (good) => {
    expect(() =>
      validateEnv({ ...VALID, JWT_ACCESS_EXPIRES_IN: good, JWT_REFRESH_EXPIRES_IN: good }),
    ).not.toThrow();
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });

  it.each(["development", "test", "production"])("accepts NODE_ENV=%s", (env) => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: env })).not.toThrow();
  });

  it("rejects a non-numeric or out-of-range PORT", () => {
    expect(() => validateEnv({ ...VALID, PORT: "not-a-number" })).toThrow(/PORT/);
    expect(() => validateEnv({ ...VALID, PORT: "0" })).toThrow(/PORT/);
    expect(() => validateEnv({ ...VALID, PORT: "70000" })).toThrow(/PORT/);
  });

  it("rejects HYBRID_*_WEIGHT outside 0-1", () => {
    expect(() => validateEnv({ ...VALID, HYBRID_CONTENT_WEIGHT: "1.2" })).toThrow(
      /HYBRID_CONTENT_WEIGHT/,
    );
    expect(() => validateEnv({ ...VALID, HYBRID_COLLABORATIVE_WEIGHT: "-0.1" })).toThrow(
      /HYBRID_COLLABORATIVE_WEIGHT/,
    );
  });

  it("accepts HYBRID_*_WEIGHT within 0-1 inclusive", () => {
    expect(() =>
      validateEnv({ ...VALID, HYBRID_CONTENT_WEIGHT: "0", HYBRID_COLLABORATIVE_WEIGHT: "1" }),
    ).not.toThrow();
  });

  it("rejects a non-positive-integer TRANSCODE_WORKER_CONCURRENCY", () => {
    expect(() => validateEnv({ ...VALID, TRANSCODE_WORKER_CONCURRENCY: "0" })).toThrow();
    expect(() => validateEnv({ ...VALID, TRANSCODE_WORKER_CONCURRENCY: "1.5" })).toThrow();
  });

  it("rejects a malformed WEB_APP_URL but allows it to be absent", () => {
    expect(() => validateEnv({ ...VALID, WEB_APP_URL: "not a url" })).toThrow(/WEB_APP_URL/);
    expect(() => validateEnv({ ...VALID })).not.toThrow();
    expect(() => validateEnv({ ...VALID, WEB_APP_URL: "https://melunemusic.app" })).not.toThrow();
  });

  it("accepts a single CORS_ORIGIN and defaults it when unset", () => {
    expect(validateEnv({ ...VALID }).CORS_ORIGIN).toBe("http://localhost:3000");
    expect(
      validateEnv({ ...VALID, CORS_ORIGIN: "https://app.melunemusic.example" }).CORS_ORIGIN,
    ).toBe("https://app.melunemusic.example");
  });

  it("accepts a comma-separated CORS_ORIGIN list where every entry is a valid URL", () => {
    expect(() =>
      validateEnv({
        ...VALID,
        CORS_ORIGIN: "https://app.melunemusic.example, https://staging.melunemusic.example",
      }),
    ).not.toThrow();
  });

  it("rejects a CORS_ORIGIN entry that isn't a valid absolute URL", () => {
    expect(() => validateEnv({ ...VALID, CORS_ORIGIN: "not-a-url" })).toThrow(/CORS_ORIGIN/);
    expect(() =>
      validateEnv({ ...VALID, CORS_ORIGIN: "https://good.example, also-not-a-url" }),
    ).toThrow(/CORS_ORIGIN/);
  });

  it("rejects a CORS_ORIGIN with an empty entry from a stray comma", () => {
    expect(() => validateEnv({ ...VALID, CORS_ORIGIN: "https://good.example,," })).toThrow(
      /stray comma/,
    );
  });

  it("leaves object storage and web push unconfigured without complaint (their own services already handle this)", () => {
    expect(() => validateEnv({ ...VALID })).not.toThrow();
  });

  it("accepts object storage / web push when fully configured", () => {
    expect(() =>
      validateEnv({
        ...VALID,
        STORAGE_ACCESS_KEY: "key",
        STORAGE_SECRET_KEY: "secret",
        VAPID_PUBLIC_KEY: "pub",
        VAPID_PRIVATE_KEY: "priv",
      }),
    ).not.toThrow();
  });

  it("rejects object storage credentials set on only one side of the pair", () => {
    expect(() => validateEnv({ ...VALID, STORAGE_ACCESS_KEY: "key" })).toThrow(/Object storage/);
    expect(() => validateEnv({ ...VALID, STORAGE_SECRET_KEY: "secret" })).toThrow(/Object storage/);
  });

  it("rejects VAPID keys set on only one side of the pair", () => {
    expect(() => validateEnv({ ...VALID, VAPID_PUBLIC_KEY: "pub" })).toThrow(/Web push/);
    expect(() => validateEnv({ ...VALID, VAPID_PRIVATE_KEY: "priv" })).toThrow(/Web push/);
  });

  it("passes through unrelated/unknown keys untouched", () => {
    const result = validateEnv({ ...VALID, SOME_FUTURE_FLAG: "on" });
    expect(result.SOME_FUTURE_FLAG).toBe("on");
  });
});
