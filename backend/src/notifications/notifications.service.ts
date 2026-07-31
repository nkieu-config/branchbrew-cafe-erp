import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Notification, NotificationType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BranchScopedUser } from '../auth/branch-scope.util';

export const NOTIFICATION_CREATED_EVENT = 'notification.created';

const ROLE_RANK: Record<Role, number> = {
  STAFF: 0,
  MANAGER: 1,
  SUPER_ADMIN: 2,
};

export function visibleMinRoles(role: Role): Role[] {
  return (Object.keys(ROLE_RANK) as Role[]).filter(
    (minRole) => ROLE_RANK[minRole] <= ROLE_RANK[role],
  );
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async notifyBranch(input: {
    branchId: number;
    minRole?: Role;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    dedupeKey?: string;
  }): Promise<Notification | null> {
    if (input.dedupeKey) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: input.type,
          branchId: input.branchId,
          dedupeKey: input.dedupeKey,
          readAt: null,
        },
      });
      if (existing) return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        branchId: input.branchId,
        minRole: input.minRole ?? 'MANAGER',
        dedupeKey: input.dedupeKey,
      },
    });

    this.eventEmitter.emit(NOTIFICATION_CREATED_EVENT, notification);
    return notification;
  }

  async notifyUser(input: {
    userId: number;
    branchId?: number | null;
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  }): Promise<Notification> {
    const notification = await this.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        userId: input.userId,
        branchId: input.branchId ?? null,
      },
    });

    this.eventEmitter.emit(NOTIFICATION_CREATED_EVENT, notification);
    return notification;
  }

  private visibilityWhere(user: BranchScopedUser, branchId?: number | null) {
    const branchScope =
      branchId != null
        ? { branchId }
        : user.branchId != null
          ? { branchId: user.branchId }
          : {};

    return {
      OR: [
        { userId: user.userId },
        {
          userId: null,
          minRole: { in: visibleMinRoles(user.role) },
          ...branchScope,
        },
      ],
    };
  }

  async listForUser(user: BranchScopedUser, branchId?: number | null) {
    return this.prisma.notification.findMany({
      where: this.visibilityWhere(user, branchId),
      orderBy: [
        { readAt: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
      take: 50,
    });
  }

  async countUnread(
    user: BranchScopedUser,
    branchId?: number | null,
  ): Promise<number> {
    return this.prisma.notification.count({
      where: { ...this.visibilityWhere(user, branchId), readAt: null },
    });
  }

  async markRead(id: number, user: BranchScopedUser) {
    const visible = await this.prisma.notification.findFirst({
      where: { id, ...this.visibilityWhere(user, null) },
    });
    if (!visible) throw new NotFoundException('Notification not found');

    if (visible.readAt === null) {
      await this.prisma.notification.updateMany({
        where: { id, ...this.visibilityWhere(user, null), readAt: null },
        data: { readAt: new Date() },
      });
    }

    return this.prisma.notification.findFirst({
      where: { id, ...this.visibilityWhere(user, null) },
    });
  }

  async markAllRead(user: BranchScopedUser, branchId?: number | null) {
    const updated = await this.prisma.notification.updateMany({
      where: { ...this.visibilityWhere(user, branchId), readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: updated.count };
  }
}
