import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Covers what AdminService's unit spec cannot: that the routes are
 * actually wired behind RolesGuard(ADMIN) at the HTTP layer, and that
 * the self-ban / self-demote guardrails hold up when hit as a real
 * admin would — through `/api/admin/...` with a bearer token — rather
 * than by calling the service directly.
 */
describe("Admin (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const admin = { email: `admin-e2e-${stamp}@example.com`, username: `adminE2E${stamp}`, password: "supersecret123" };
  const otherAdmin = { email: `admin2-e2e-${stamp}@example.com`, username: `admin2E2E${stamp}`, password: "supersecret123" };
  const plainUser = { email: `user-e2e-${stamp}@example.com`, username: `userE2E${stamp}`, password: "supersecret123" };
  const targetUser = { email: `target-e2e-${stamp}@example.com`, username: `targetE2E${stamp}`, password: "supersecret123" };

  let adminId: string;
  let adminToken: string;
  let otherAdminToken: string;
  let userToken: string;
  let targetUserId: string;

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
    adminId = adminRes.body.user.id;
    await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
    adminToken = (await request(http).post("/api/auth/login").send(admin).expect(200)).body.accessToken;

    const otherAdminRes = await request(http).post("/api/auth/register").send(otherAdmin).expect(201);
    await prisma.user.update({ where: { id: otherAdminRes.body.user.id }, data: { role: "ADMIN" } });
    otherAdminToken = (await request(http).post("/api/auth/login").send(otherAdmin).expect(200)).body.accessToken;

    await request(http).post("/api/auth/register").send(plainUser).expect(201);
    userToken = (await request(http).post("/api/auth/login").send(plainUser).expect(200)).body.accessToken;

    const targetRes = await request(http).post("/api/auth/register").send(targetUser).expect(201);
    targetUserId = targetRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [admin.email, otherAdmin.email, plainUser.email, targetUser.email] },
      },
    });
    await app.close();
  });

  describe("role enforcement", () => {
    it("rejects every admin route without a token", async () => {
      await request(http).get("/api/admin/stats").expect(401);
      await request(http).get("/api/admin/users").expect(401);
      await request(http).patch(`/api/admin/users/${targetUserId}/ban`).expect(401);
    });

    it("rejects a non-admin user with 403 on stats, users, role, ban and unban", async () => {
      await request(http).get("/api/admin/stats").set("Authorization", `Bearer ${userToken}`).expect(403);
      await request(http).get("/api/admin/users").set("Authorization", `Bearer ${userToken}`).expect(403);
      await request(http)
        .patch(`/api/admin/users/${targetUserId}/role`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ role: "ARTIST" })
        .expect(403);
      await request(http)
        .patch(`/api/admin/users/${targetUserId}/ban`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
      await request(http)
        .patch(`/api/admin/users/${targetUserId}/unban`)
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe("dashboard + user listing", () => {
    it("returns aggregate stats to an admin", async () => {
      const res = await request(http)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.totals).toEqual(
        expect.objectContaining({
          users: expect.any(Number),
          artists: expect.any(Number),
          songs: expect.any(Number),
        }),
      );
    });

    it("lists users and lets an admin filter by search query", async () => {
      const res = await request(http)
        .get(`/api/admin/users?q=${encodeURIComponent(targetUser.username)}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.items.some((u: { id: string }) => u.id === targetUserId)).toBe(true);
    });
  });

  describe("self-demote / self-ban guardrails over HTTP", () => {
    it("blocks an admin from demoting their own role via the real HTTP route", async () => {
      const res = await request(http)
        .patch(`/api/admin/users/${adminId}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "USER" })
        .expect(400);

      expect(res.body.message).toMatch(/cannot change your own admin role/i);

      const stillAdmin = await prisma.user.findUnique({ where: { id: adminId } });
      expect(stillAdmin?.role).toBe("ADMIN");
    });

    it("blocks an admin from banning their own account via the real HTTP route", async () => {
      const res = await request(http)
        .patch(`/api/admin/users/${adminId}/ban`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(res.body.message).toMatch(/cannot ban your own account/i);

      const stillActive = await prisma.user.findUnique({ where: { id: adminId } });
      expect(stillActive?.deletedAt).toBeNull();
    });

    it("still lets a *different* admin change the first admin's role", async () => {
      await request(http)
        .patch(`/api/admin/users/${adminId}/role`)
        .set("Authorization", `Bearer ${otherAdminToken}`)
        .send({ role: "ADMIN" })
        .expect(200);
    });
  });

  describe("ban / unban lifecycle over HTTP", () => {
    it("bans a target user and immediately revokes their access", async () => {
      await request(http)
        .patch(`/api/admin/users/${targetUserId}/ban`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      // The account is soft-deleted; logging in again must fail even
      // though the password is unchanged.
      await request(http)
        .post("/api/auth/login")
        .send(targetUser)
        .expect((res) => {
          expect(res.status).not.toBe(200);
        });
    });

    it("returns 404 when banning a user id that doesn't exist", async () => {
      await request(http)
        .patch("/api/admin/users/not-a-real-id/ban")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);
    });

    it("unbans the target user and restores login", async () => {
      await request(http)
        .patch(`/api/admin/users/${targetUserId}/unban`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      await request(http).post("/api/auth/login").send(targetUser).expect(200);
    });
  });
});
