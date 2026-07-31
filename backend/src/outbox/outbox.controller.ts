import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiCommonErrorResponses } from '../common/http/swagger-error.decorators';
import { PaginationQueryDto } from '../common/pagination/pagination-query.dto';
import { OutboxService } from './outbox.service';
import { OutboxEventResponseDto } from './dto/outbox-response.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('outbox')
@ApiCommonErrorResponses()
@Controller('outbox')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Get('failed')
  @Roles('SUPER_ADMIN')
  @ApiOperation({
    summary: 'List outbox events that exhausted their retries',
  })
  @ApiOkResponse({
    type: OutboxEventResponseDto,
    isArray: true,
    description: 'Failed outbox events retrieved',
  })
  listFailed(@Query() query: PaginationQueryDto) {
    return this.outboxService.listFailed(query);
  }

  @Post(':id/replay')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Requeue a failed outbox event' })
  @ApiOkResponse({
    type: OutboxEventResponseDto,
    description: 'Outbox event requeued',
  })
  replay(@Param('id', ParseIntPipe) id: number) {
    return this.outboxService.replayFailed(id);
  }
}
