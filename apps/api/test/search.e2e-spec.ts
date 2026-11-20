import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Search (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const listener = { email: `search-${stamp}@example.com`, username: `search${stamp}`, password: "supersecret123" };
  const artistUser = { email: `searchartist-${stamp}@example.com`, username: `searchartist${stamp}`, password: "supersecret123" };

  const uniqueTitle = `Zorbaxion${stamp}`;

  let listenerToken: string;
  let songId: string;

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

    await request(http).post("/api/auth/register").send(listener).expect(201);
    listenerToken = (await request(http).post("/api/auth/login").send(listener).expect(200)).body.accessToken;

    const artistRes = await request(http).post("/api/auth/register").send(artistUser).expect(201);
    const artist = await prisma.artist.create({
      data: { userId: artistRes.body.user.id, name: `Search E2E Artist ${stamp}`, slug: `search-e2e-artist-${stamp}` },
    });

    const song = await prisma.song.create({
      data: {
        title: uniqueTitle,
        slug: `zorbaxion-${stamp}`,
        artistId: artist.id,
        duration: 180,
        audioUrl: "https://example.com/search-e2e-song.mp3",
      },
    });
    songId = song.id;
  });

  afterAll(async () => {
    await prisma.searchHistory.deleteMany({ where: { user: { email: listener.email } } });
    await prisma.song.deleteMany({ where: { id: songId } });
    await prisma.artist.deleteMany({ where: { user: { email: artistUser.email } } });
    await prisma.user.deleteMany({ where: { email: { in: [listener.email, artistUser.email] } } });
    await app.close();
  });

  it("finds the song via the default quick (type=all) search", async () => {
    const res = await request(http).get(`/api/search?q=${uniqueTitle}`).expect(200);
    expect(res.body.songs.some((s: { id: string }) => s.id === songId)).toBe(true);
  });

  it("finds the song via type=songs with pagination", async () => {
    const res = await request(http)
      .get(`/api/search?q=${uniqueTitle}&type=songs&page=1&limit=10`)
      .expect(200);
    expect(res.body.items.some((s: { id: string }) => s.id === songId)).toBe(true);
    expect(res.body.page).toBe(1);
  });

  it("tolerates typos via trigram similarity", async () => {
    const typo = uniqueTitle.slice(0, -1); // drop the last character
    const res = await request(http).get(`/api/search?q=${typo}`).expect(200);
    expect(res.body.songs.some((s: { id: string }) => s.id === songId)).toBe(true);
  });

  it("rejects a query shorter than 1 character", async () => {
    await request(http).get("/api/search?q=").expect(400);
  });

  it("requires auth to record or read search history", async () => {
    await request(http).post("/api/search/history").send({ query: uniqueTitle }).expect(401);
    await request(http).get("/api/search/history").expect(401);
  });

  it("records, lists, and clears a signed-in user's search history", async () => {
    await request(http)
      .post("/api/search/history")
      .set("Authorization", `Bearer ${listenerToken}`)
      .send({ query: uniqueTitle })
      .expect(204);

    const history = await request(http)
      .get("/api/search/history")
      .set("Authorization", `Bearer ${listenerToken}`)
      .expect(200);
    expect(history.body.some((h: { query: string }) => h.query === uniqueTitle)).toBe(true);

    await request(http)
      .delete("/api/search/history")
      .set("Authorization", `Bearer ${listenerToken}`)
      .expect(204);

    const afterClear = await request(http)
      .get("/api/search/history")
      .set("Authorization", `Bearer ${listenerToken}`)
      .expect(200);
    expect(afterClear.body.length).toBe(0);
  });
});
