import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Library (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const listener = { email: `listener-${stamp}@example.com`, username: `listener${stamp}`, password: "supersecret123" };
  const otherUser = { email: `other-${stamp}@example.com`, username: `other${stamp}`, password: "supersecret123" };
  const artistUser = { email: `libartist-${stamp}@example.com`, username: `libartist${stamp}`, password: "supersecret123" };

  let listenerToken: string;
  let otherToken: string;
  let artistToken: string;
  let songId: string;
  let albumId: string;
  let playlistId: string;

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
    listenerToken = (
      await request(http).post("/api/auth/login").send(listener).expect(200)
    ).body.accessToken;
    void listenerRes;

    await request(http).post("/api/auth/register").send(otherUser).expect(201);
    otherToken = (
      await request(http).post("/api/auth/login").send(otherUser).expect(200)
    ).body.accessToken;

    const artistRes = await request(http).post("/api/auth/register").send(artistUser).expect(201);
    await prisma.user.update({ where: { id: artistRes.body.user.id }, data: { role: "ARTIST" } });
    artistToken = (
      await request(http).post("/api/auth/login").send(artistUser).expect(200)
    ).body.accessToken;

    await request(http)
      .post("/api/artists")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ name: `Library E2E Artist ${stamp}` })
      .expect(201);

    const albumRes = await request(http)
      .post("/api/albums")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({ title: `Library E2E Album ${stamp}` })
      .expect(201);
    albumId = albumRes.body.id;

    const songRes = await request(http)
      .post("/api/songs")
      .set("Authorization", `Bearer ${artistToken}`)
      .send({
        title: `Library E2E Song ${stamp}`,
        albumId,
        duration: 200,
        audioUrl: "https://example.com/library-e2e-song.mp3",
      })
      .expect(201);
    songId = songRes.body.id;
  });

  afterAll(async () => {
    await prisma.playlistSong.deleteMany({ where: { song: { id: songId } } });
    await prisma.playlist.deleteMany({ where: { ownerId: { in: await ownerIds() } } });
    await prisma.libraryItem.deleteMany({ where: { userId: { in: await ownerIds() } } });
    await prisma.like.deleteMany({ where: { songId } });
    await prisma.listeningHistory.deleteMany({ where: { songId } });
    await prisma.song.deleteMany({ where: { id: songId } });
    await prisma.album.deleteMany({ where: { id: albumId } });
    await prisma.artist.deleteMany({ where: { user: { email: artistUser.email } } });
    await prisma.notification.deleteMany({
      where: { user: { email: { in: [listener.email, otherUser.email, artistUser.email] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [listener.email, otherUser.email, artistUser.email] } },
    });
    await app.close();

    async function ownerIds() {
      const users = await prisma.user.findMany({
        where: { email: { in: [listener.email, otherUser.email] } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
  });

  describe("Likes", () => {
    it("requires auth to like a song", async () => {
      await request(http).post(`/api/songs/${songId}/like`).expect(401);
    });

    it("lets a user like, list, and unlike a song idempotently", async () => {
      await request(http)
        .post(`/api/songs/${songId}/like`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      // liking twice is a no-op, not an error
      await request(http)
        .post(`/api/songs/${songId}/like`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      const mine = await request(http)
        .get("/api/me/likes")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(200);
      expect(mine.body.items.some((s: { id: string }) => s.id === songId)).toBe(true);

      await request(http)
        .delete(`/api/songs/${songId}/like`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      const afterUnlike = await request(http)
        .get("/api/me/likes")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(200);
      expect(afterUnlike.body.items.some((s: { id: string }) => s.id === songId)).toBe(false);
    });
  });

  describe("Playlists", () => {
    it("lets a user create a private playlist, add a song, and reorder it", async () => {
      const createRes = await request(http)
        .post("/api/playlists")
        .set("Authorization", `Bearer ${listenerToken}`)
        .send({ title: `E2E Playlist ${stamp}`, isPublic: false })
        .expect(201);
      playlistId = createRes.body.id;

      await request(http)
        .post(`/api/playlists/${playlistId}/songs`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .send({ songId })
        .expect(201);

      // adding the same song twice is rejected
      await request(http)
        .post(`/api/playlists/${playlistId}/songs`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .send({ songId })
        .expect(400);

      await request(http)
        .patch(`/api/playlists/${playlistId}/songs/reorder`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .send({ songIds: [songId] })
        .expect(200);
    });

    it("hides a private playlist from other users and from the public listing", async () => {
      await request(http)
        .get(`/api/playlists/${playlistId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(404);

      const publicList = await request(http).get("/api/playlists").expect(200);
      expect(publicList.body.items.some((p: { id: string }) => p.id === playlistId)).toBe(false);
    });

    it("forbids a non-owner from modifying the playlist", async () => {
      await request(http)
        .delete(`/api/playlists/${playlistId}/songs/${songId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(403);
    });

    it("lets the owner remove the song and delete the playlist", async () => {
      await request(http)
        .delete(`/api/playlists/${playlistId}/songs/${songId}`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      await request(http)
        .delete(`/api/playlists/${playlistId}`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);
    });
  });

  describe("Saved items (library)", () => {
    it("lets a user save and unsave an album", async () => {
      await request(http)
        .post(`/api/me/library/albums/${albumId}`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      const mine = await request(http)
        .get("/api/me/library?type=album")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(200);
      expect(mine.body.items.some((i: { albumId: string | null }) => i.albumId === albumId)).toBe(true);

      await request(http)
        .delete(`/api/me/library/albums/${albumId}`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);
    });

    it("404s when saving a non-existent album", async () => {
      await request(http)
        .post("/api/me/library/albums/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(404);
    });
  });

  describe("Listening history", () => {
    it("records a play and surfaces it in /me/history, bumping playCount", async () => {
      const before = await request(http).get(`/api/songs/${songId}`).expect(200);

      await request(http)
        .post(`/api/me/history/${songId}`)
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(204);

      const after = await request(http).get(`/api/songs/${songId}`).expect(200);
      expect(after.body.playCount).toBe(before.body.playCount + 1);

      const history = await request(http)
        .get("/api/me/history")
        .set("Authorization", `Bearer ${listenerToken}`)
        .expect(200);
      expect(history.body.some((s: { id: string }) => s.id === songId)).toBe(true);
    });
  });
});
