import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentType, EquipmentStatus, Prisma } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  assertBranchAccess,
  BranchScopedUser,
} from '../auth/branch-scope.util';
import { NotificationsService } from '../notifications/notifications.service';

export type EquipmentUpdateFields = {
  name?: string;
  type?: EquipmentType;
  serialNumber?: string;
  status?: EquipmentStatus;
  purchaseDate?: string;
  warrantyExpiry?: string;
  nextMaintenanceDate?: string;
};

function toEquipmentUpdateInput(
  changes: EquipmentUpdateFields,
): Prisma.EquipmentUpdateInput {
  const data: Prisma.EquipmentUpdateInput = {};
  if (changes.name !== undefined) data.name = changes.name;
  if (changes.type !== undefined) data.type = changes.type;
  if (changes.serialNumber !== undefined)
    data.serialNumber = changes.serialNumber;
  if (changes.status !== undefined) data.status = changes.status;
  if (changes.purchaseDate !== undefined) {
    data.purchaseDate = new Date(changes.purchaseDate);
  }
  if (changes.warrantyExpiry !== undefined) {
    data.warrantyExpiry = new Date(changes.warrantyExpiry);
  }
  if (changes.nextMaintenanceDate !== undefined) {
    data.nextMaintenanceDate = new Date(changes.nextMaintenanceDate);
  }
  return data;
}

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.debug('Running daily equipment maintenance check...');
    await this.checkMaintenanceSchedules();
  }

  async checkMaintenanceSchedules() {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    // Find all active equipment that need maintenance within 7 days
    const equipmentList = await this.prisma.equipment.findMany({
      where: {
        status: 'ACTIVE',
        nextMaintenanceDate: { lte: nextWeek },
      },
      include: { branch: true },
    });

    for (const eq of equipmentList) {
      this.logger.warn(
        `Alert: Equipment [${eq.name}] at Branch [${eq.branch.name}] is due for maintenance by ${eq.nextMaintenanceDate?.toLocaleDateString()}`,
      );
      await this.notifications.notifyBranch({
        branchId: eq.branchId,
        type: 'MAINTENANCE_DUE',
        title: `${eq.name} is due for maintenance`,
        body: eq.nextMaintenanceDate
          ? `Scheduled by ${eq.nextMaintenanceDate.toISOString().slice(0, 10)}`
          : undefined,
        link: '/assets',
        dedupeKey: `equipment-${eq.id}`,
      });
    }
  }

  async findAll(branchId?: number) {
    return this.prisma.equipment.findMany({
      where: branchId ? { branchId } : undefined,
      include: { branch: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number, user?: BranchScopedUser) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id },
      include: { branch: true, maintenanceLogs: { orderBy: { date: 'desc' } } },
    });
    if (!equipment) throw new NotFoundException('Equipment not found');
    if (user) assertBranchAccess(user, equipment.branchId);
    return equipment;
  }

  async create(data: {
    branchId: number;
    name: string;
    type: EquipmentType;
    serialNumber?: string;
    purchaseDate?: Date;
    warrantyExpiry?: Date;
    nextMaintenanceDate?: Date;
  }) {
    return this.prisma.equipment.create({ data });
  }

  async update(
    id: number,
    changes: EquipmentUpdateFields,
    user?: BranchScopedUser,
  ) {
    if (user) {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id },
      });
      if (!equipment) throw new NotFoundException('Equipment not found');
      assertBranchAccess(user, equipment.branchId);
    }

    return this.prisma.equipment.update({
      where: { id },
      data: toEquipmentUpdateInput(changes),
    });
  }

  async logMaintenance(
    equipmentId: number,
    data: {
      description: string;
      cost: number;
      performedBy?: string;
      date: Date;
      nextMaintenanceDate?: Date;
      newStatus?: EquipmentStatus;
    },
    user?: BranchScopedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUnique({
        where: { id: equipmentId },
      });
      if (!equipment) throw new NotFoundException('Equipment not found');
      if (user) assertBranchAccess(user, equipment.branchId);

      const log = await tx.maintenanceLog.create({
        data: {
          equipmentId,
          description: data.description,
          cost: data.cost,
          performedBy: data.performedBy,
          date: data.date,
        },
      });

      const updateData: Prisma.EquipmentUpdateInput = {};
      if (data.nextMaintenanceDate)
        updateData.nextMaintenanceDate = data.nextMaintenanceDate;
      if (data.newStatus) updateData.status = data.newStatus;

      if (Object.keys(updateData).length > 0) {
        await tx.equipment.update({
          where: { id: equipmentId },
          data: updateData,
        });
      }

      return log;
    });
  }
}
