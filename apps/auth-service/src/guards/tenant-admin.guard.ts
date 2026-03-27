import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../modules/users/user.entity';

type AuthenticatedRequest = {
  user?: {
    role?: UserRole;
    tenantId?: string;
  };
  params?: Record<string, string | undefined>;
};

@Injectable()
export class TenantAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const tenantParam = request.params?.tenantId ?? request.params?.id;

    const hasTenantAdminRole = user?.role === UserRole.TENANT_ADMIN;
    const isSameTenant = Boolean(user?.tenantId) && user?.tenantId === tenantParam;

    if (!hasTenantAdminRole || !isSameTenant) {
      throw new ForbiddenException('Tenant admin access denied');
    }

    return true;
  }
}
