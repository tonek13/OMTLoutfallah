import { AsyncLocalStorage } from 'async_hooks';

type TenantContextStore = {
  tenantId?: string;
};

const tenantContextStorage = new AsyncLocalStorage<TenantContextStore>();

export class TenantContext {
  static runWithTenant<T>(tenantId: string | undefined, callback: () => T): T {
    return tenantContextStorage.run({ tenantId }, callback);
  }

  static getTenantId(): string | undefined {
    return tenantContextStorage.getStore()?.tenantId;
  }
}
