const { ForbiddenException } = require('@nestjs/common');
const { TenantAdminGuard } = require('./tenant-admin.guard.ts');

function createContext(user, params) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
    }),
  };
}

describe('TenantAdminGuard', () => {
  it('allows tenant admin on matching tenantId route param', () => {
    const guard = new TenantAdminGuard();
    const context = createContext(
      { role: 'tenant_admin', tenantId: 'tenant-1' },
      { tenantId: 'tenant-1' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows tenant admin on matching id route param', () => {
    const guard = new TenantAdminGuard();
    const context = createContext(
      { role: 'tenant_admin', tenantId: 'tenant-1' },
      { id: 'tenant-1' },
    );

    expect(guard.canActivate(context)).toBe(true);
  });

  it("Admin of Tenant A cannot call admin endpoints of Tenant B", () => {
    const guard = new TenantAdminGuard();
    const context = createContext(
      { role: 'tenant_admin', tenantId: 'tenant-1' },
      { tenantId: 'tenant-2' },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects non-tenant-admin role even for matching tenant', () => {
    const guard = new TenantAdminGuard();
    const context = createContext(
      { role: 'admin', tenantId: 'tenant-1' },
      { tenantId: 'tenant-1' },
    );

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
