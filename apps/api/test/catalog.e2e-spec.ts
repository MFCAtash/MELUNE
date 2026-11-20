import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Catalog (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const admin = { email: `admin-${stamp}@example.com`, username: `admin${stamp}`, password: "supersecret123" };
  const artistUser = { email: `artist-${stamp}@example.com`, username: `artist${stamp}`, password: "supersecret123" };

  let adminToken: string;
  let artistToken: string;
  let genreId: string;
  let albumId: string;

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

    const adminRes = await request(http).post("/api/auth/register").send(admin).expect(201);
    await prisma.user.update({ where: { id: adminRes.body.user.id }, data: { role: "ADMIN" } });
    const adminLogin = await request(http).post("/api/auth/login").send(admin).expect(200);
    adminToken = adminLogin.body.accessToken;

    const artistRes = await request(http).post("/api/auth/register").send(artistUser).expect(201);
    await prisma.user.update({ where: { id: artistRes.body.user.id }, data: { role: "ARTIST" } });
    const artistLogin = await request(http).post("/api/auth/login").send(artistUser).expect(200);
    artistToken = artistLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.song.deleteMany({ where: { title: "E2E Test Song" } });
    await prisma.album.deleteMany({ where: { title: "E2E Test Album" } });
    await prisma.artist.deleteMany({ where: { user: { email: artistUser.email } } });
    await prisma.genre.deleteMany({ where: { name: "E2E Test Genre" } });
    await prisma.user.deleteMany({ where: { email: { in: [admin.email, artistUser.email] } } });
    await app.close();
  });

  it("rejects genre creation from a non-admin", async () => {
    await request(http)
      .post("/api/genres")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ name: "Should Fail" })
      .expect(403);
  });

  it("lets an admin create a genre", async () => {
    const res = await request(http)
      .post("/api/genres")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "E2E Test Genre" })
      .expect(201);
    genreId = res.body.id;
    expect(res.body.slug).toBe("e2e-test-genre");
  });

  it("requires an artist profile before creating an album", async () => {
    await request(http)
      .post("/api/albums")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ title: "Should Fail" })
      .expect(404);
  });

  it("lets an ARTIST create their profile, then an album and a song", async () => {
    await request(http)
      .post("/api/artists")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ name: "E2E Test Artist" })
      .expect(201);

    const albumRes = await request(http)
      .post("/api/albums")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ title: "E2E Test Album" })
      .expect(201);
    albumId = albumRes.body.id;

    const songRes = await request(http)
      .post("/api/songs")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({
        title: "E2E Test Song",
        albumId,
        genreId,
        duration: 180,
        audioUrl: "https://example.com/song.mp3",
      })
      .expect(201);

    expect(songRes.body.slug).toBe("e2e-test-song");
  });

  it("exposes the new song publicly via list and detail", async () => {
    const list = await request(http).get(`/api/songs?albumId=${albumId}`).expect(200);
    expect(list.body.items.length).toBeGreaterThan(0);

    await request(http).get("/api/songs/e2e-test-song").expect(200);
  });
});
