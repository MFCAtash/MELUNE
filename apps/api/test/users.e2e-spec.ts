import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Users (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<INestApplication["getHttpServer"]>;

  const stamp = Date.now();
  const userA = { email: `usera-${stamp}@example.com`, username: `usera${stamp}`, password: "supersecret123" };
  const userB = { email: `userb-${stamp}@example.com`, username: `userb${stamp}`, password: "supersecret123" };

  let tokenA: string;
  let userAId: string;

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

    const regA = await request(http).post("/api/auth/register").send(userA).expect(201);
    userAId = regA.body.user.id;
    tokenA = (await request(http).post("/api/auth/login").send(userA).expect(200)).body.accessToken;

    await request(http).post("/api/auth/register").send(userB).expect(201);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    await app.close();
  });

  it("returns the welcome notification created on registration", async () => {
    const res = await request(http)
      .get("/api/me/notifications")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.items.some((n: { type: string }) => n.type === "welcome")).toBe(true);

    const unread = await request(http)
      .get("/api/me/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(unread.body.count).toBeGreaterThanOrEqual(1);
  });

  it("GET /users/me returns the caller's own profile", async () => {
    const res = await request(http)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body.id).toBe(userAId);
    expect(res.body.email).toBe(userA.email);
    // password must never be exposed, even implicitly
    expect(res.body.password).toBeUndefined();
  });

  it("PATCH /users/me updates the profile and rejects unknown fields", async () => {
    const res = await request(http)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ bio: "Updated via e2e test" })
      .expect(200);
    expect(res.body.bio).toBe("Updated via e2e test");

    await request(http)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ role: "ADMIN" }) // not a whitelisted field on UpdateUserDto
      .expect(200)
      .expect((r) => {
        // class-validator's whitelist strips unknown fields rather than
        // rejecting the request — assert it was silently dropped, not applied.
        expect(r.body.role).toBe("USER");
      });
  });

  it("GET /users/:id is public and returns another user's public profile", async () => {
    const res = await request(http).get(`/api/users/${userAId}`).expect(200);
    expect(res.body.id).toBe(userAId);
  });

  it("returns 404 for a non-existent user id", async () => {
    await request(http).get("/api/users/00000000-0000-0000-0000-000000000000").expect(404);
  });

  it("marks a notification read and reflects it in the unread count", async () => {
    const list = await request(http)
      .get("/api/me/notifications")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    const notificationId = list.body.items[0].id;

    await request(http)
      .patch(`/api/me/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    await request(http)
      .post("/api/me/notifications/read-all")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(204);

    const unread = await request(http)
      .get("/api/me/notifications/unread-count")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);
    expect(unread.body.count).toBe(0);
  });
});
