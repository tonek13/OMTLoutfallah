import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, Request, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from 'apps/auth-service/src/guards/jwt-auth.guard';
import {
  CreateOrganizationDto,
  CreateOrganizationCurrencyDto,
  AddOrganizationMemberDto,
  MintTokensDto,
} from './dto/currency.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { sub: string };
};

@ApiTags('Currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  // TENANTS

  @Post('tenants')
  @ApiOperation({ summary: 'Create a new tenant (organization)' })
  createTenant(@Body() dto: CreateOrganizationDto, @Request() req: AuthenticatedRequest) {
    return this.currencyService.createTenant(dto, req.user.sub);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant details' })
  getTenant(@Param('id') id: string) {
    return this.currencyService.getTenant(id);
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Update tenant settings' })
  updateTenant(
    @Param('id') id: string,
    @Body() body: Partial<CreateOrganizationDto>,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.currencyService.updateTenant(id, req.user.sub, body);
  }

  // CURRENCIES

  @Post('tenants/:tenantId/currencies')
  @ApiOperation({ summary: 'Create a currency for a tenant' })
  createCurrency(@Param('tenantId') tenantId: string, @Body() dto: CreateOrganizationCurrencyDto) {
    return this.currencyService.createCurrency(tenantId, dto);
  }

  @Get('tenants/:tenantId/currencies')
  @ApiOperation({ summary: 'List all currencies for a tenant' })
  listCurrencies(@Param('tenantId') tenantId: string) {
    return this.currencyService.listCurrencies(tenantId);
  }

  @Get('tenants/:tenantId/currencies/:currencyId')
  @ApiOperation({ summary: 'Get currency details' })
  getCurrency(@Param('tenantId') tenantId: string, @Param('currencyId') currencyId: string) {
    return this.currencyService.getCurrency(currencyId, tenantId);
  }

  // MEMBERSHIPS

  @Post('tenants/:tenantId/currencies/:currencyId/members')
  @ApiOperation({ summary: 'Add a member wallet for a currency' })
  addMember(
    @Param('tenantId') tenantId: string,
    @Param('currencyId') currencyId: string,
    @Body() dto: AddOrganizationMemberDto,
  ) {
    return this.currencyService.addMember(tenantId, currencyId, dto);
  }

  @Get('wallets/me')
  @ApiOperation({ summary: 'Get my wallets in a tenant' })
  getMyWallet(@Request() req: AuthenticatedRequest) {
    const tenantHeader = req.headers['x-tenant-id'];
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.currencyService.getMyWallet(req.user.sub, tenantId);
  }

  // MINT

  @Post('tenants/:tenantId/mint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mint tokens to a member wallet (admin only)' })
  mintTokens(@Param('tenantId') tenantId: string, @Body() dto: MintTokensDto) {
    return this.currencyService.mintTokens(tenantId, dto);
  }
}
