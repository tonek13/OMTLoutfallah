const { BadRequestException } = require('@nestjs/common');
const { TransferService } = require('./transfer.service.ts');
const { Currency, TransferType } = require('../entities/transfer.entity.ts');

function createTransferService({
  receiverTenantId,
}) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(async () => ({ total: '0' })),
  };

  const transferRepo = {
    createQueryBuilder: jest.fn(() => qb),
    count: jest.fn(async () => 0),
  };

  const dataSource = {
    query: jest.fn(async () => (receiverTenantId ? [{ tenantId: receiverTenantId }] : [])),
    createQueryRunner: jest.fn(() => {
      throw new Error('Transaction should not start for blocked cross-tenant transfer');
    }),
  };

  const service = new TransferService(transferRepo, dataSource);
  return { service, dataSource };
}

describe('TransferService tenant isolation', () => {
  it('Transfer from Tenant A user fails if receiver is Tenant B member', async () => {
    const { service, dataSource } = createTransferService({ receiverTenantId: 'tenant-b' });

    await expect(
      service.createTransfer(
        'sender-a',
        'tenant-a',
        {
          receiverPhone: '+96170123456',
          receiverName: 'Receiver B',
          amount: 100,
          currency: Currency.USD,
          type: TransferType.DOMESTIC,
        },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.query).toHaveBeenCalled();
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });
});
