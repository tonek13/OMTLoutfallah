import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, Request, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

import { CurrencyService } from './currency.service';
import { JwtAuthGuard } from 'apps/auth-service/src/guards/jwt-auth.guard';
import { TenantAdminGuard } from 'apps/auth-service/src/guards/tenant-admin.guard';
import { UserRole } from 'apps/auth-service/src/modules/users/user.entity';
import {
  UpdateTenantSettingsDto,
  CreateOrganizationCurrencyDto,
  AddOrganizationMemberDto,
  MintTokensDto,
  TenantResponseDto,
  CurrencyResponseDto,
  CurrencyStatsResponseDto,
  WalletResponseDto,
} from './dto/currency.dto';

type AuthenticatedRequest = ExpressRequest & {
  user: { id: string; role: UserRole; tenantId: string };
};

@ApiTags('Currency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  // TENANTS

  @Get('tenants/my')
  @ApiOperation({ summary: 'List tenant organizations available to current user' })
  @ApiOkResponse({ type: TenantResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  listMyTenants(@Request() req: AuthenticatedRequest) {
    return this.currencyService.listTenantsForUser(req.user.id, req.user.tenantId);
  }

  @Get('tenants/:id')
  @UseGuards(TenantAdminGuard)
  @ApiOperation({ summary: 'Get tenant details' })
  @ApiParam({ name: 'id', description: 'Tenant ID', format: 'uuid' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  getTenant(@Param('id') id: string) {
    return this.currencyService.getTenant(id);
  }

  @Patch('tenants/:id')
  @UseGuards(TenantAdminGuard)
  @ApiOperation({ summary: 'Update tenant settings' })
  @ApiParam({ name: 'id', description: 'Tenant ID', format: 'uuid' })
  @ApiBody({ type: UpdateTenantSettingsDto })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  updateTenant(
    @Param('id') id: string,
    @Body() body: UpdateTenantSettingsDto,
  ) {
    return this.currencyService.updateTenant(id, body);
  }

  // CURRENCIES

  @Post('tenants/:tenantId/currencies')
  @UseGuards(TenantAdminGuard)
  @ApiOperation({ summary: 'Create a currency for a tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID', format: 'uuid' })
  @ApiBody({ type: CreateOrganizationCurrencyDto })
  @ApiCreatedResponse({
    description: 'Currency created successfully',
    type: CurrencyResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiConflictResponse({ description: 'Currency symbol already exists in this tenant' })
  createCurrency(
    @Param('tenantId') tenantId: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateOrganizationCurrencyDto,
  ) {
    return this.currencyService.createCurrency(tenantId, req.user.id, dto);
  }

  @Post('currencies')
  @UseGuards(TenantAdminGuard)
  @ApiOperation({ summary: 'Create a currency for the current tenant' })
  @ApiBody({ type: CreateOrganizationCurrencyDto })
  @ApiCreatedResponse({
    description: 'Currency created successfully',
    type: CurrencyResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiConflictResponse({ description: 'Currency symbol already exists in this tenant' })
  createCurrencyForCurrentTenant(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateOrganizationCurrencyDto,
  ) {
    return this.currencyService.createCurrency(req.user.tenantId, req.user.id, dto);
  }

  @Get('tenants/:tenantId/currencies')
  @ApiOperation({ summary: 'List all currencies for a tenant' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID', format: 'uuid' })
  @ApiOkResponse({ type: CurrencyResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  listCurrencies(@Param('tenantId') tenantId: string) {
    return this.currencyService.listCurrencies(tenantId);
  }

  @Get('tenants/:tenantId/currencies/:currencyId')
  @ApiOperation({ summary: 'Get currency details' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID', format: 'uuid' })
  @ApiParam({ name: 'currencyId', description: 'Currency ID', format: 'uuid' })
  @ApiOkResponse({ type: CurrencyResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiNotFoundResponse({ description: 'Currency not found for this tenant' })
  getCurrency(@Param('tenantId') tenantId: string, @Param('currencyId') currencyId: string) {
    return this.currencyService.getCurrency(currencyId, tenantId);
  }

  @Get('currencies/:id')
  @ApiOperation({ summary: 'Get currency info and live stats for current tenant' })
  @ApiParam({ name: 'id', description: 'Currency ID', format: 'uuid' })
  @ApiOkResponse({ type: CurrencyStatsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'You are not a member of this tenant' })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  getCurrencyStats(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.currencyService.getCurrencyStats(id, req.user.tenantId);
  }

  // MEMBERSHIPS

  @Post('tenants/:tenantId/currencies/:currencyId/members')
  @UseGuards(TenantAdminGuard)
  @ApiOperation({ summary: 'Add a member wallet for a currency' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID', format: 'uuid' })
  @ApiParam({ name: 'currencyId', description: 'Currency ID', format: 'uuid' })
  @ApiBody({ type: AddOrganizationMemberDto })
  @ApiCreatedResponse({
    description: 'Member wallet created successfully',
    type: WalletResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiNotFoundResponse({ description: 'Currency not found' })
  @ApiConflictResponse({ description: 'User already has a wallet for this currency' })
  addMember(
    @Param('tenantId') tenantId: string,
    @Param('currencyId') currencyId: string,
    @Body() dto: AddOrganizationMemberDto,
  ) {
    return this.currencyService.addMember(tenantId, currencyId, dto);
  }

  @Get('wallets/me')
  @ApiOperation({ summary: 'Get my wallets in a tenant' })
  @ApiHeader({
    name: 'x-tenant-id',
    required: true,
    description: 'Tenant context for wallet retrieval',
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiOkResponse({ type: WalletResponseDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiBadRequestResponse({ description: 'x-tenant-id header is required' })
  getMyWallet(@Request() req: AuthenticatedRequest) {
    const tenantHeader = req.headers['x-tenant-id'];
    const tenantId = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
    if (!tenantId) {
      throw new BadRequestException('x-tenant-id header is required');
    }

    return this.currencyService.getMyWallet(req.user.id, tenantId);
  }

  // MINT

  @Post('tenants/:tenantId/mint')
  @UseGuards(TenantAdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mint tokens to a member wallet (admin only)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID', format: 'uuid' })
  @ApiBody({ type: MintTokensDto })
  @ApiOkResponse({
    description: 'Wallet balance updated after minting',
    type: WalletResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  @ApiForbiddenResponse({ description: 'Tenant admin access denied' })
  @ApiNotFoundResponse({ description: 'Membership wallet or currency not found' })
  mintTokens(@Param('tenantId') tenantId: string, @Body() dto: MintTokensDto) {
    return this.currencyService.mintTokens(tenantId, dto);
  }
}
