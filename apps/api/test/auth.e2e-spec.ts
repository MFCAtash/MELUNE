import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Auth (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    email: `e2e-${Date.now()}@example.com`,
    username: `e2e${Date.now()}`,
    password: "supersecret123",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  it("registers a new user and returns an access token + refresh cookie", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(testUser)
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects duplicate registration", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .send(testUser)
      .expect(409);
  });

  it("logs in with correct credentials", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects GET /users/me without a token", async () => {
    await request(app.getHttpServer()).get("/api/users/me").expect(401);
  });

  it("returns the current user with a valid access token", async () => {
    const loginRes = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/users/me")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(testUser.email);
      });
  });
});
