import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../src/prisma/prisma.service';
import { createE2eApp } from './e2e-app.util';
import { E2E_PASSWORD } from './e2e-fixtures.util';

const describeIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDatabase('Customer 360 never leaks order internals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const managerEmail = 'crm-manager@e2e.test';
  const branchName = 'E2E CRM Branch';
  const productName = 'E2E CRM Latte';
  const customerPhone = '0899999001';
  let customerId: number;

  beforeAll(async () => {
    app = await createE2eApp();
    prisma = app.get(PrismaService);

    const branch = await prisma.branch.create({
      data: { name: branchName, location: 'Metro City' },
    });

    const manager = await prisma.user.create({
      data: {
        email: managerEmail,
        name: 'CRM Manager',
        password: await bcrypt.hash(E2E_PASSWORD, 10),
        role: 'MANAGER',
        branchId: branch.id,
      },
    });

    const product = await prisma.product.create({
      data: { name: productName, price: 100, category: 'Coffee' },
    });

    const customer = await prisma.customer.create({
      data: { phone: customerPhone, name: 'CRM Customer' },
    });
    customerId = customer.id;

    await prisma.order.create({
      data: {
        branchId: branch.id,
        userId: manager.id,
        customerId: customer.id,
        totalAmount: 150,
        netAmount: 150,
        totalCogs: 42,
        status: 'COMPLETED',
        isTaxInvoiceRequested: true,
        taxInvoiceName: 'Secret Buyer Co Ltd',
        taxInvoiceTaxId: '0105512345678',
        taxInvoiceAddress: '99 Secret Road, Bangkok',
        items: {
          create: [{ productId: product.id, quantity: 2, price: 75 }],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.orderItem.deleteMany({
      where: { order: { customer: { phone: customerPhone } } },
    });
    await prisma.order.deleteMany({
      where: { customer: { phone: customerPhone } },
    });
    await prisma.customer.deleteMany({ where: { phone: customerPhone } });
    await prisma.product.deleteMany({ where: { name: productName } });
    await prisma.user.deleteMany({ where: { email: managerEmail } });
    await prisma.branch.deleteMany({ where: { name: branchName } });
    await app?.close();
  });

  it('returns spend history without tax-invoice, cost or routing fields', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({ email: managerEmail, password: E2E_PASSWORD })
      .expect(200);

    const res = await agent.get(`/customers/${customerId}/360`).expect(200);

    expect(res.body.recentOrders).toHaveLength(1);
    const [order] = res.body.recentOrders;

    expect(Number(order.netAmount)).toBe(150);
    expect(order.items).toHaveLength(1);

    expect(order).not.toHaveProperty('taxInvoiceName');
    expect(order).not.toHaveProperty('taxInvoiceTaxId');
    expect(order).not.toHaveProperty('taxInvoiceAddress');
    expect(order).not.toHaveProperty('totalCogs');
    expect(order).not.toHaveProperty('branchId');
    expect(order).not.toHaveProperty('userId');

    expect(JSON.stringify(res.body)).not.toContain('0105512345678');
    expect(JSON.stringify(res.body)).not.toContain('99 Secret Road');
  });

  it('does not repeat the order history inside the customer profile', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/auth/login')
      .send({ email: managerEmail, password: E2E_PASSWORD })
      .expect(200);

    const res = await agent.get(`/customers/${customerId}/360`).expect(200);

    expect(res.body.customer).not.toHaveProperty('orders');
  });
});
