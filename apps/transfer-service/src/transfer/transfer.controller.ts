import {
  Controller, Post, Get, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import { CreateTransferDto } from '../dto/transfer.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

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
  async create(@Body() dto: CreateTransferDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.ip;
    return this.transferService.createTransfer(req.user.sub, dto, ip);
  }

  @Get()
  @ApiOperation({ summary: 'Get my transfer history' })
  async getMyTransfers(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.transferService.getUserTransfers(req.user.sub, +page, +limit);
  }

  @Get(':reference')
  @ApiOperation({ summary: 'Get transfer by reference code' })
  async getOne(@Param('reference') ref: string, @Req() req: any) {
    return this.transferService.getByReference(ref, req.user.sub);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending transfer' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.transferService.cancelTransfer(id, req.user.sub);
  }
}
