import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { RealtimeGateway } from './realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import {
  MockPrismaService,
  PrismaServiceMockProvider,
} from '../prisma/prisma.service.mock';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let prisma: MockPrismaService;
  let jwt: { verify: jest.Mock };

  const buildClient = (cookie?: string) =>
    ({
      id: 'socket-1',
      handshake: { headers: cookie ? { cookie } : {}, auth: {} },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    }) as unknown as Socket;

  beforeEach(async () => {
    jwt = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        PrismaServiceMockProvider,
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    gateway = module.get(RealtimeGateway);
    prisma = module.get(PrismaService);
  });

  it('drops a socket whose token was revoked after it was issued', async () => {
    jwt.verify.mockReturnValue({
      sub: 7,
      email: 'staff@e2e.test',
      role: 'STAFF',
      branchId: 1,
      tokenVersion: 3,
    });
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 4 } as any);

    const client = buildClient('erp_access_token=stale');
    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('drops a socket whose user no longer exists', async () => {
    jwt.verify.mockReturnValue({
      sub: 404,
      email: 'gone@e2e.test',
      role: 'STAFF',
      branchId: 1,
      tokenVersion: 0,
    });
    prisma.user.findUnique.mockResolvedValue(null);

    const client = buildClient('erp_access_token=orphan');
    await gateway.handleConnection(client);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('admits a current token and scopes it to its own branch room', async () => {
    jwt.verify.mockReturnValue({
      sub: 7,
      email: 'staff@e2e.test',
      role: 'STAFF',
      branchId: 1,
      tokenVersion: 3,
    });
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 3 } as any);

    const client = buildClient('erp_access_token=fresh');
    await gateway.handleConnection(client);

    expect(client.disconnect).not.toHaveBeenCalled();
    expect(client.join).toHaveBeenCalledWith('branch:1');
  });

  it('verifies the token with the signing algorithm pinned', async () => {
    jwt.verify.mockReturnValue({
      sub: 7,
      email: 'staff@e2e.test',
      role: 'STAFF',
      branchId: 1,
      tokenVersion: 0,
    });
    prisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 } as any);

    await gateway.handleConnection(buildClient('erp_access_token=fresh'));

    expect(jwt.verify).toHaveBeenCalledWith('fresh', {
      algorithms: ['HS256'],
    });
  });

  it('never reaches the database when no token is presented', async () => {
    const client = buildClient();
    await gateway.handleConnection(client);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  describe('notification fan-out', () => {
    const connectAs = async (role: Role, sub: number) => {
      jwt.verify.mockReturnValue({
        sub,
        email: `${role}@e2e.test`,
        role,
        branchId: 1,
        tokenVersion: 0,
      });
      prisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 } as any);

      const client = buildClient('erp_access_token=fresh');
      await gateway.handleConnection(client);
      return client;
    };

    it('does not put a staff socket in the manager notification room', async () => {
      const client = await connectAs('STAFF', 7);
      const rooms = (client.join as jest.Mock).mock.calls.flat();

      expect(rooms).toContain('branch:1:notify:STAFF');
      expect(rooms).not.toContain('branch:1:notify:MANAGER');
      expect(rooms).not.toContain('branch:1:notify:SUPER_ADMIN');
    });

    it('puts a manager socket in both the staff and manager rooms', async () => {
      const client = await connectAs('MANAGER', 8);
      const rooms = (client.join as jest.Mock).mock.calls.flat();

      expect(rooms).toContain('branch:1:notify:STAFF');
      expect(rooms).toContain('branch:1:notify:MANAGER');
      expect(rooms).not.toContain('branch:1:notify:SUPER_ADMIN');
    });

    it('sends a manager-only notification to the manager room, not the whole branch', () => {
      const emit = jest.fn();
      gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

      gateway.handleNotificationCreated({
        id: 1,
        type: 'PO_PENDING_APPROVAL',
        title: 'PO-2026-001 awaiting approval',
        body: null,
        link: '/procurement/orders',
        branchId: 1,
        minRole: 'MANAGER',
        userId: null,
        dedupeKey: null,
        readAt: null,
        createdAt: new Date(),
      });

      expect(gateway.server.to).toHaveBeenCalledWith('branch:1:notify:MANAGER');
      expect(gateway.server.to).not.toHaveBeenCalledWith('branch:1');
    });

    it('sends a personally addressed notification only to that user', () => {
      const emit = jest.fn();
      gateway.server = { to: jest.fn().mockReturnValue({ emit }) } as never;

      gateway.handleNotificationCreated({
        id: 2,
        type: 'LEAVE_DECIDED',
        title: 'Your sick leave was approved',
        body: null,
        link: '/hr/leave',
        branchId: 1,
        minRole: 'STAFF',
        userId: 42,
        dedupeKey: null,
        readAt: null,
        createdAt: new Date(),
      });

      expect(gateway.server.to).toHaveBeenCalledWith('user:42');
      expect(gateway.server.to).not.toHaveBeenCalledWith('branch:1');
    });
  });
});
