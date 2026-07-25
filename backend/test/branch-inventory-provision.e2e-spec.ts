import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './e2e-app.util';
import { E2E_PASSWORD } from './e2e-fixtures.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase('Branch inventory auto-provision (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const adminEmail = 'provision-admin@e2e.test';
  let ingredientIds: number[];

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Provision Admin',
        password: await bcrypt.hash(E2E_PASSWORD, 10),
        role: 'SUPER_ADMIN',
      },
    });

    const ingredients = await Promise.all([
      prisma.ingredient.create({
        data: { name: 'E2E Provision A', unit: 'g', costPerUnit: 1 },
      }),
      prisma.ingredient.create({
        data: { name: 'E2E Provision B', unit: 'ml', costPerUnit: 2 },
      }),
    ]);
    ingredientIds = ingredients.map((i) => i.id);
  });

  afterAll(async () => {
    await prisma.branchInventory.deleteMany({
      where: {
        OR: [
          { branch: { name: { startsWith: 'E2E Provision Branch' } } },
          { ingredient: { name: { startsWith: 'E2E Provision' } } },
        ],
      },
    });
    await prisma.ingredient.deleteMany({
      where: { name: { startsWith: 'E2E Provision' } },
    });
    await prisma.branch.deleteMany({
      where: {
        name: {
          in: ['E2E Provision Branch', 'E2E Provision Branch Existing'],
        },
      },
    });
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await app?.close();
  });

  it('provisions BranchInventory for all ingredients when a branch is created', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: adminEmail, password: E2E_PASSWORD })
      .expect(200);

    const branchRes = await agent
      .post('/branches')
      .send({ name: 'E2E Provision Branch', location: 'Metro City' })
      .expect(201);

    const branchId = branchRes.body.id as number;
    const rows = await prisma.branchInventory.findMany({
      where: { branchId, ingredientId: { in: ingredientIds } },
      orderBy: { ingredientId: 'asc' },
    });

    expect(rows).toHaveLength(ingredientIds.length);
    expect(rows.every((r) => r.stock === 0)).toBe(true);
    expect(rows.every((r) => r.minStock === 100)).toBe(true);
    expect(rows.map((r) => r.ingredientId).sort((a, b) => a - b)).toEqual(
      [...ingredientIds].sort((a, b) => a - b),
    );
  });

  it('provisions BranchInventory for all branches when an ingredient is created', async () => {
    const branch = await prisma.branch.create({
      data: { name: 'E2E Provision Branch Existing', location: 'Chiang Mai' },
    });

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: adminEmail, password: E2E_PASSWORD })
      .expect(200);

    const ingredientRes = await agent
      .post('/ingredients')
      .send({
        name: 'E2E Provision New Ingredient',
        unit: 'pcs',
        costPerUnit: 5,
      })
      .expect(201);

    const ingredientId = ingredientRes.body.id as number;
    const branchCount = await prisma.branch.count();

    const rows = await prisma.branchInventory.findMany({
      where: { ingredientId },
    });

    expect(rows).toHaveLength(branchCount);
    expect(rows.some((r) => r.branchId === branch.id)).toBe(true);
    expect(rows.every((r) => r.stock === 0)).toBe(true);
  });
});
