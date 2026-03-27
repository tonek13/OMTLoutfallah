const { from, lastValueFrom } = require('rxjs');
const { ForbiddenException, NotFoundException } = require('@nestjs/common');
const { Repository } = require('typeorm');
const { TransferService } = require('../transfer/transfer.service.ts');
const { TenantContextInterceptor } = require('./tenant-context.interceptor.ts');
const { TypeOrmTenantScopeInitializer } = require('./typeorm-tenant-scope.initializer.ts');

function createTenantAwareTransferRepository() {
  const metadata = {
    target: { name: 'Transfer' },
    findColumnWithPropertyName: (propertyName) =>
      propertyName === 'tenantId' ? { propertyName: 'tenantId' } : undefined,
  };

  const manager = {
    connection: {
      getMetadata: () => metadata,
    },
    findOne: jest.fn(async (_target, options) => {
      const where = options?.where ?? {};
      if (where.referenceCode === 'REF-B' && where.tenantId === 'tenant-b') {
        return { id: 'tx-b', senderId: 'user-b', referenceCode: 'REF-B' };
      }
      return null;
    }),
  };

  const repository = Object.create(Repository.prototype);
  repository.target = metadata.target;
  repository.manager = manager;

  return { repository, manager };
}

function createExecutionContext(user) {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe('Tenant TypeORM Scoping', () => {
  beforeAll(() => {
    new TypeOrmTenantScopeInitializer().onModuleInit();
  });

  it('prevents a user from Tenant A from reading Tenant B data', async () => {
    const { repository, manager } = createTenantAwareTransferRepository();
    const transferService = new TransferService(repository, {});
    const interceptor = new TenantContextInterceptor();

    const context = createExecutionContext({ sub: 'user-a', tenantId: 'tenant-a' });
    const next = {
      handle: () => from(transferService.getByReference('REF-B', 'user-a')),
    };

    await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(manager.findOne).toHaveBeenCalledTimes(1);
    expect(manager.findOne.mock.calls[0][1].where.tenantId).toBe('tenant-a');
  });

  it('allows reading data when tenant and owner match', async () => {
    const { repository } = createTenantAwareTransferRepository();
    const transferService = new TransferService(repository, {});
    const interceptor = new TenantContextInterceptor();

    const context = createExecutionContext({ sub: 'user-b', tenantId: 'tenant-b' });
    const next = {
      handle: () => from(transferService.getByReference('REF-B', 'user-b')),
    };

    await expect(lastValueFrom(interceptor.intercept(context, next))).resolves.toEqual(
      expect.objectContaining({
        id: 'tx-b',
        referenceCode: 'REF-B',
      }),
    );
  });

  it('returns forbidden for same-tenant transfer owned by another user', async () => {
    const { repository } = createTenantAwareTransferRepository();
    const transferService = new TransferService(repository, {});
    const interceptor = new TenantContextInterceptor();

    const context = createExecutionContext({ sub: 'user-c', tenantId: 'tenant-b' });
    const next = {
      handle: () => from(transferService.getByReference('REF-B', 'user-c')),
    };

    await expect(lastValueFrom(interceptor.intercept(context, next))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
