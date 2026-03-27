import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CreateTenantDto,
  CreateTenantResponseDto,
} from './dto/create-tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create tenant organization and initial admin user',
  })
  @ApiBody({ type: CreateTenantDto })
  @ApiCreatedResponse({
    description: 'Tenant, admin account, and tokens created',
    type: CreateTenantResponseDto,
  })
  @ApiConflictResponse({
    description: 'Tenant slug, admin email, or admin phone already exists',
  })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  create(@Body() dto: CreateTenantDto, @Req() req: any) {
    return this.tenantsService.createTenant(dto, req.ip);
  }
}
