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
});
