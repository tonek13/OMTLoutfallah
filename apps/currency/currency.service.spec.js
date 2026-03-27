const { CurrencyService } = require('./currency.service.ts');

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
});
