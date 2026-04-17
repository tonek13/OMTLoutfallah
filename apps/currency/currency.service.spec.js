const { CurrencyService } = require('./currency.service.ts');
const { ForbiddenException } = require('@nestjs/common');

function createServiceWithWallets(seedWallets) {
  const walletRepo = {
    find: jest.fn(async (options) => {
      const where = options?.where ?? {};
      return seedWallets.filter(
        (wallet) => wallet.userId === where.userId && wallet.tenantId === where.tenantId,
      );
    }),
  };

  const service = new CurrencyService(
    {},
    {},
    walletRepo,
    {},
  );

  return { service, walletRepo };
}

describe('CurrencyService tenant isolation', () => {
  it('User A cannot read User B wallet from a different tenant', async () => {
    const userAWallet = { id: 'w-a', userId: 'user-a', tenantId: 'tenant-a', currencyId: 'c-a' };
    const userBWallet = { id: 'w-b', userId: 'user-b', tenantId: 'tenant-b', currencyId: 'c-b' };
    const { service, walletRepo } = createServiceWithWallets([userAWallet, userBWallet]);

    const result = await service.getMyWallet('user-a', 'tenant-a');

    expect(walletRepo.find).toHaveBeenCalledWith({
      where: { userId: 'user-a', tenantId: 'tenant-a' },
      relations: ['currency'],
    });
    expect(result).toEqual([userAWallet]);
    expect(result).not.toContainEqual(userBWallet);
  });

  it('returns currency stats for members of the same tenant', async () => {
    const currencyRepo = {
      findOne: jest.fn(async () => ({
        id: 'currency-1',
        tenantId: 'tenant-a',
        name: 'Campus Coin',
        symbol: 'ACC',
        circulatingSupply: '875000',
      })),
    };

    const walletRepo = {
      count: jest.fn(async () => 214),
    };

    const dataSource = {
      query: jest.fn(async () => [{ totalTransfers: '5096' }]),
    };

    const service = new CurrencyService({}, currencyRepo, walletRepo, dataSource);
    const result = await service.getCurrencyStats('currency-1', 'tenant-a');

    expect(walletRepo.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', currencyId: 'currency-1' },
    });
    expect(dataSource.query).toHaveBeenCalled();
    expect(result).toEqual({
      name: 'Campus Coin',
      symbol: 'ACC',
      circulatingSupply: 875000,
      totalWallets: 214,
      totalTransfers: 5096,
    });
  });

  it('rejects stats access for users from another tenant', async () => {
    const currencyRepo = {
      findOne: jest.fn(async () => ({
        id: 'currency-1',
        tenantId: 'tenant-b',
        name: 'Campus Coin',
        symbol: 'ACC',
        circulatingSupply: '1000',
      })),
    };

    const walletRepo = {
      count: jest.fn(async () => 0),
    };

    const dataSource = {
      query: jest.fn(async () => [{ totalTransfers: '0' }]),
    };

    const service = new CurrencyService({}, currencyRepo, walletRepo, dataSource);

    await expect(service.getCurrencyStats('currency-1', 'tenant-a')).rejects.toThrow(ForbiddenException);
    expect(walletRepo.count).not.toHaveBeenCalled();
  });

  it('returns zero transfers when transfers table does not exist', async () => {
    const currencyRepo = {
      findOne: jest.fn(async () => ({
        id: 'currency-1',
        tenantId: 'tenant-a',
        name: 'Campus Coin',
        symbol: 'ACC',
        circulatingSupply: '1000',
      })),
    };

    const walletRepo = {
      count: jest.fn(async () => 2),
    };

    const dataSource = {
      query: jest.fn(async () => {
        throw new Error('relation "transfers" does not exist');
      }),
    };

    const service = new CurrencyService({}, currencyRepo, walletRepo, dataSource);
    const result = await service.getCurrencyStats('currency-1', 'tenant-a');

    expect(result.totalTransfers).toBe(0);
  });

  it('mints to a recipient wallet, increases circulating supply, and writes an audit log', async () => {
    const currency = {
      id: 'currency-1',
      tenantId: 'tenant-a',
      circulatingSupply: '1000',
    };
    const wallet = {
      id: 'wallet-1',
      userId: 'recipient-1',
      tenantId: 'tenant-a',
      currencyId: 'currency-1',
      balance: '125',
    };

    const manager = {
      findOne: jest.fn(async (entity, options) => {
        if (entity?.name === 'Currency') return currency;
        if (entity?.name === 'Wallet') {
          return options?.where?.userId === 'recipient-1' ? wallet : null;
        }
        return null;
      }),
      save: jest.fn(async (_entity, value) => value),
      create: jest.fn((_entity, payload) => payload),
    };

    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
      query: jest.fn(async () => [{ totalTransfers: '0' }]),
    };

    const service = new CurrencyService({}, {}, {}, dataSource);
    const result = await service.mintCurrencyToRecipient(
      'currency-1',
      'admin-1',
      'tenant-a',
      { recipientId: 'recipient-1', amount: 25, reason: 'Monthly reward' },
    );

    expect(result.balance).toBe(150);
    expect(currency.circulatingSupply).toBe(1025);

    const auditLogSaveCall = manager.save.mock.calls.find(
      ([entity]) => entity?.name === 'AuditLog',
    );

    expect(auditLogSaveCall).toBeDefined();
    expect(auditLogSaveCall[1]).toMatchObject({
      tenantId: 'tenant-a',
      actorUserId: 'admin-1',
      eventType: 'currency.minted',
      entityType: 'wallet',
      entityId: 'wallet-1',
      payload: expect.objectContaining({
        currencyId: 'currency-1',
        recipientId: 'recipient-1',
        amount: 25,
        reason: 'Monthly reward',
      }),
    });
  });

  it('rejects minting for a currency outside the admin tenant', async () => {
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity?.name === 'Currency') {
          return { id: 'currency-1', tenantId: 'tenant-b', circulatingSupply: '500' };
        }
        return null;
      }),
      save: jest.fn(async (_entity, value) => value),
      create: jest.fn((_entity, payload) => payload),
    };

    const dataSource = {
      transaction: jest.fn(async (work) => work(manager)),
      query: jest.fn(async () => [{ totalTransfers: '0' }]),
    };

    const service = new CurrencyService({}, {}, {}, dataSource);

    await expect(
      service.mintCurrencyToRecipient('currency-1', 'admin-1', 'tenant-a', {
        recipientId: 'recipient-1',
        amount: 10,
        reason: 'Test',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
