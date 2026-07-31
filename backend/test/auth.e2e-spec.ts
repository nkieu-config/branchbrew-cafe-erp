import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { AUTH_COOKIE_NAME } from '../src/auth/auth-cookie.util';
import { createE2eApp } from './e2e-app.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase('Auth cookies (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testEmail = 'cookie-auth-e2e@example.com';
  const testPassword = 'password123';

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);

    const branch = await prisma.branch.create({
      data: { name: 'E2E Branch', location: 'Test' },
    });

    await prisma.user.create({
      data: {
        email: testEmail,
        name: 'E2E User',
        password: await bcrypt.hash(testPassword, 10),
        role: 'STAFF',
        branchId: branch.id,
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: testEmail } });
    await prisma.branch.deleteMany({ where: { name: 'E2E Branch' } });
    await app?.close();
  });

  it('sets httpOnly cookie on login and serves /auth/me', async () => {
    const agent = request.agent(app.getHttpServer());

    const loginRes = await agent
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    expect(loginRes.body).toHaveProperty('user');
    expect(loginRes.body).not.toHaveProperty('access_token');

    const setCookie = loginRes.headers['set-cookie'];
    const cookies = Array.isArray(setCookie)
      ? setCookie
      : setCookie
        ? [setCookie]
        : [];
    const cookie = cookies.find((value) =>
      value.startsWith(`${AUTH_COOKIE_NAME}=`),
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');

    const meRes = await agent.get('/auth/me').expect(200);
    expect(meRes.body.email).toBe(testEmail);
  });

  it('clears cookie on logout', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword })
      .expect(200);

    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);
  });

  it('refuses form-encoded bodies, so a cross-site form POST cannot drive a state change', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .type('form')
      .send({ email: testEmail, password: testPassword })
      .expect(400);

    const cookieHeader = await agent.get('/auth/me').expect(401);
    expect(cookieHeader.body.statusCode).toBe(401);
  });
});
