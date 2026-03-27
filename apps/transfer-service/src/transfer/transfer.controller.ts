import {
  Controller, Post, Get, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import {
  CreateTransferDto,
  TransferResponseDto,
  TransferListResponseDto,
  TransferCancelResponseDto,
} from '../dto/transfer.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import type { JwtPayload } from '../../../../libs/common/src/types/jwt-payload.type';

type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip: string;
  user: JwtPayload;
};

@ApiTags('Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 transfers/min max
  @ApiOperation({ summary: 'Create a new money transfer' })
  @ApiBody({ type: CreateTransferDto })
  @ApiCreatedResponse({
    description: 'Transfer created successfully',
    type: TransferResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiBadRequestResponse({
    description: 'Validation error, daily limit exceeded, or cross-tenant transfer blocked',
  })
  async create(@Body() dto: CreateTransferDto, @Req() req: AuthenticatedRequest) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor ?? req.ip;
    return this.transferService.createTransfer(req.user.sub, req.user.tenantId, dto, ip);
  }

  @Get()
  @ApiOperation({ summary: 'Get my transfer history' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based)',
    schema: { type: 'integer', minimum: 1, default: 1 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Records per page',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  })
  @ApiOkResponse({
    description: 'Paginated transfer list',
    type: TransferListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async getMyTransfers(
    @Req() req: AuthenticatedRequest,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.transferService.getUserTransfers(req.user.sub, +page, +limit);
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Get transfer by reference code' })
  @ApiParam({
    name: 'reference',
    description: 'Transfer reference code',
    example: 'OMT-2026-X9A31F',
  })
  @ApiOkResponse({ type: TransferResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Transfer does not belong to requester' })
  @ApiNotFoundResponse({ description: 'Transfer not found' })
  async getOne(@Param('reference') ref: string, @Req() req: AuthenticatedRequest) {
    return this.transferService.getByReference(ref, req.user.sub);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending transfer' })
  @ApiParam({ name: 'id', description: 'Transfer ID', format: 'uuid' })
  @ApiOkResponse({
    description: 'Transfer cancellation status',
    type: TransferCancelResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Transfer does not belong to requester' })
  @ApiNotFoundResponse({ description: 'Transfer not found' })
  @ApiBadRequestResponse({ description: 'Only pending transfers can be cancelled' })
  async cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.transferService.cancelTransfer(id, req.user.sub);
  }
}
