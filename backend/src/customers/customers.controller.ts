import {
  Controller,
  Delete,
  Get,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import type { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';
import {
  Customer360ResponseDto,
  CustomerResponseDto,
} from './dto/customer-response.dto';

@ApiTags('customers')
@ApiCommonErrorResponses()
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create customer' })
  @ApiOkResponse({ type: CustomerResponseDto, description: 'Customer created' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'List customers — the member directory, not a till lookup',
  })
  @ApiOkResponse({
    type: CustomerResponseDto,
    isArray: true,
    description: 'Customers retrieved',
  })
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @Get('phone/:phone')
  @ApiOperation({
    summary: 'Look up one member by exact phone — the POS till path',
  })
  @ApiOkResponse({
    type: CustomerResponseDto,
    description: 'Customer retrieved',
  })
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id/360')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get customer 360 view' })
  @ApiOkResponse({
    type: Customer360ResponseDto,
    description: 'Customer profile retrieved',
  })
  getCustomer360(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.getCustomer360(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get customer by id' })
  @ApiOkResponse({
    type: CustomerResponseDto,
    description: 'Customer retrieved',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customersService.findOne(id);
  }

  @Roles('SUPER_ADMIN', 'MANAGER')
  @Patch(':id')
  @ApiOperation({ summary: 'Update customer' })
  @ApiOkResponse({ type: CustomerResponseDto, description: 'Customer updated' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Delete(':id')
  @ApiOperation({
    summary: 'Erase a member on PDPA request by anonymizing the record',
    description:
      'Clears the phone, name and points and stamps anonymizedAt. The row itself stays so orders, revenue and the ledger are unchanged, and tax-invoice details on those orders are retained under the Revenue Code.',
  })
  @ApiOkResponse({
    type: CustomerResponseDto,
    description: 'Customer anonymized',
  })
  anonymize(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: RequestWithUser,
  ) {
    return this.customersService.anonymize(id, req.user.userId);
  }
}
