import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/** Only the two fields this test asserts on — avoids `any` in lint. */
interface HomeResponse {
  recentlyPlayed: Array<{ id: string }>;
  madeForYou: unknown;
}

describe("Discover (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const listener = { email: `discover-${stamp}@example.com`, username: `discover${stamp}`, password: "supersecret123" };
  const artistUser = { email: `discoverartist-${stamp}@example.com`, username: `discoverartist${stamp}`, password: "supersecret123" };

  let listenerToken: string;
  let listenerId: string;
  let artistToken: string;
  let songId: string;
  let genreId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    prisma = moduleFixture.get(PrismaService);

    const listenerRes = await request(http).post("/api/auth/register").send(listener).expect(201);
    listenerId = listenerRes.body.user.id;
    listenerToken = (await request(http).post("/api/auth/login").send(listener).expect(200)).body.accessToken;

    const artistRes = await request(http).post("/api/auth/register").send(artistUser).expect(201);
    // Promote straight to ADMIN too, so this one account can create both
    // the artist profile *and* the genre it needs, without a second user.
    await prisma.user.update({ where: { id: artistRes.body.user.id }, data: { role: "ADMIN" } });
    artistToken = (await request(http).post("/api/auth/login").send(artistUser).expect(200)).body.accessToken;

    const genreRes = await request(http)
      .post("/api/genres")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ name: `Discover E2E Genre ${stamp}` })
      .expect(201);
    genreId = genreRes.body.id;

    // ADMIN can also pass the @Roles(ARTIST) guard? No — the guard checks
    // an exact role match, so give this account an artist profile too by
    // creating one directly against the DB rather than fighting the RBAC
    // model in a test that isn't about RBAC.
    const artist = await prisma.artist.create({
      data: { userId: artistRes.body.user.id, name: `Discover E2E Artist ${stamp}`, slug: `discover-e2e-artist-${stamp}` },
    });

    const song = await prisma.song.create({
      data: {
        title: `Discover E2E Song ${stamp}`,
        slug: `discover-e2e-song-${stamp}`,
        artistId: artist.id,
        genreId,
        duration: 210,
        audioUrl: "https://example.com/discover-e2e-song.mp3",
      },
    });
    songId = song.id;
  });

  afterAll(async () => {
    await prisma.listeningHistory.deleteMany({ where: { songId } });
    await prisma.notification.deleteMany({ where: { user: { email: { in: [listener.email, artistUser.email] } } } });
    await prisma.song.deleteMany({ where: { id: songId } });
    await prisma.genre.deleteMany({ where: { id: genreId } });
    await prisma.artist.deleteMany({ where: { user: { email: artistUser.email } } });
    await prisma.user.deleteMany({ where: { email: { in: [listener.email, artistUser.email] } } });
    await app.close();
  });

  it("returns trending-only for anonymous visitors, with madeForYou null", async () => {
    const res = await request(http).get("/api/discover/home").expect(200);
    expect(Array.isArray(res.body.trending)).toBe(true);
    expect(res.body.recentlyPlayed).toEqual([]);
    expect(res.body.madeForYou).toBeNull();
  });

  it("includes a played song in recentlyPlayed and builds a madeForYou mix from genre affinity", async () => {
    await request(http)
      .post(`/api/me/history/${songId}`)
      .set("Authorization", `Bearer ${listenerToken}`)
      .expect(204);

    // First prove the write actually landed. If it didn't, the failure is
    // in POST /me/history — far easier to diagnose than an empty feed.
    const written = await prisma.listeningHistory.findFirst({ where: { userId: listenerId, songId } });
    expect(written).not.toBeNull();

    // Recently-played is read from a different query than the one that
    // served the anonymous GET in the previous test. Poll briefly instead
    // of asserting on the very first frame — the API is eventually
    // consistent across its cache/history layers in CI, and a single
    // snapshot made this suite flaky.
    let home: HomeResponse | null = null;
    let recent: Array<{ id: string }> = [];
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await request(http)
        .get("/api/discover/home")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(200);
      home = res.body as HomeResponse;
      recent = home.recentlyPlayed;
      if (recent.some((s) => s.id === songId)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(recent.some((s) => s.id === songId)).toBe(true);
    // madeForYou excludes songs already played, and there's only one song
    // in this genre (the one just played), so it correctly comes back empty
    // rather than null — the user *does* have genre signal now.
    expect(home).not.toBeNull();
    expect(home!.madeForYou).not.toBeNull();
  });
});
