import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { resolveBranchId } from '../auth/branch-scope.util';
import { parseOptionalPositiveInt } from '../common/query-params.util';
import {
  CreateEquipmentDto,
  LogMaintenanceDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';
import {
  EquipmentDetailResponseDto,
  EquipmentResponseDto,
  MaintenanceLogResponseDto,
} from './dto/equipment-response.dto';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('equipment')
@ApiCommonErrorResponses()
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @ApiOperation({ summary: 'List equipment by branch' })
  @ApiOkResponse({
    type: EquipmentResponseDto,
    isArray: true,
    description: 'Equipment list retrieved',
  })
  findAll(
    @Request() req: RequestWithUser,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const branchId = resolveBranchId(
      req.user,
      parseOptionalPositiveInt(branchIdQuery, 'branchId'),
    );
    return this.equipmentService.findAll(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get equipment by id' })
  @ApiOkResponse({
    type: EquipmentDetailResponseDto,
    description: 'Equipment retrieved',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.equipmentService.findOne(id, req.user);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Post()
  @ApiOperation({ summary: 'Create equipment' })
  @ApiOkResponse({
    type: EquipmentResponseDto,
    description: 'Equipment created',
  })
  create(@Body() dto: CreateEquipmentDto, @Request() req: RequestWithUser) {
    const branchId = resolveBranchId(req.user, dto.branchId);
    return this.equipmentService.create({
      branchId,
      name: dto.name,
      type: dto.type,
      serialNumber: dto.serialNumber,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      warrantyExpiry: dto.warrantyExpiry
        ? new Date(dto.warrantyExpiry)
        : undefined,
      nextMaintenanceDate: dto.nextMaintenanceDate
        ? new Date(dto.nextMaintenanceDate)
        : undefined,
    });
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Patch(':id')
  @ApiOperation({ summary: 'Update equipment' })
  @ApiOkResponse({
    type: EquipmentResponseDto,
    description: 'Equipment updated',
  })
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipmentService.update(id, dto, req.user);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Post(':id/maintenance')
  @ApiOperation({ summary: 'Log equipment maintenance' })
  @ApiOkResponse({
    type: MaintenanceLogResponseDto,
    description: 'Maintenance logged',
  })
  logMaintenance(
    @Request() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LogMaintenanceDto,
  ) {
    return this.equipmentService.logMaintenance(
      id,
      {
        description: dto.description,
        cost: dto.cost,
        performedBy: dto.performedBy,
        date: dto.date ? new Date(dto.date) : new Date(),
        nextMaintenanceDate: dto.nextMaintenanceDate
          ? new Date(dto.nextMaintenanceDate)
          : undefined,
        newStatus: dto.newStatus,
      },
      req.user,
    );
  }
}
