import { Injectable, OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContext } from './tenant-context';

const PATCHED_MARKER = Symbol.for('omt.transfer.tenant-scope.patched');
const TENANT_KEY = 'tenantId';
const TENANT_PARAM = '__tenant_scope_tenant_id';

type PatchedRepositoryPrototype = Repository<Record<string, unknown>> & {
  [PATCHED_MARKER]?: boolean;
};

function hasTenantColumn(repository: Repository<Record<string, unknown>>): boolean {
  return Boolean(repository.metadata.findColumnWithPropertyName(TENANT_KEY));
}

function scopeWhereClause(where: unknown, tenantId: string): Record<string, unknown> {
  if (!where || typeof where !== 'object') {
    return { [TENANT_KEY]: tenantId };
  }

  return { ...(where as Record<string, unknown>), [TENANT_KEY]: tenantId };
}

function scopeWhere(where: unknown, tenantId: string): unknown {
  if (Array.isArray(where)) {
    return where.map((item) => scopeWhereClause(item, tenantId));
  }

  return scopeWhereClause(where, tenantId);
}

function scopeFindOptions(options: unknown, tenantId: string): Record<string, unknown> {
  if (!options || typeof options !== 'object') {
    return { where: { [TENANT_KEY]: tenantId } };
  }

  const rawOptions = options as Record<string, unknown>;
  return {
    ...rawOptions,
    where: scopeWhere(rawOptions.where, tenantId),
  };
}

function scopeCriteria(criteria: unknown, tenantId: string): unknown {
  if (criteria === undefined || criteria === null) {
    return { [TENANT_KEY]: tenantId };
  }

  if (typeof criteria === 'string' || typeof criteria === 'number') {
    return { id: criteria, [TENANT_KEY]: tenantId };
  }

  if (Array.isArray(criteria)) {
    return criteria.map((item) => scopeCriteria(item, tenantId));
  }

  if (typeof criteria === 'object') {
    return { ...(criteria as Record<string, unknown>), [TENANT_KEY]: tenantId };
  }

  return criteria;
}

function patchRepositoryPrototype() {
  const repositoryPrototype = Repository.prototype as PatchedRepositoryPrototype;
  if (repositoryPrototype[PATCHED_MARKER]) {
    return;
  }

  repositoryPrototype[PATCHED_MARKER] = true;

  const originalFind = repositoryPrototype.find;
  repositoryPrototype.find = function find(options?: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalFind.call(this, options as never);
    }

    return originalFind.call(this, scopeFindOptions(options, tenantId) as never);
  };

  const originalFindOne = repositoryPrototype.findOne;
  repositoryPrototype.findOne = function findOne(options: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalFindOne.call(this, options as never);
    }

    return originalFindOne.call(this, scopeFindOptions(options, tenantId) as never);
  };

  const originalFindAndCount = repositoryPrototype.findAndCount;
  repositoryPrototype.findAndCount = function findAndCount(options?: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalFindAndCount.call(this, options as never);
    }

    return originalFindAndCount.call(this, scopeFindOptions(options, tenantId) as never);
  };

  const originalCount = repositoryPrototype.count;
  repositoryPrototype.count = function count(options?: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalCount.call(this, options as never);
    }

    return originalCount.call(this, scopeFindOptions(options, tenantId) as never);
  };

  const originalFindBy = repositoryPrototype.findBy;
  repositoryPrototype.findBy = function findBy(where: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalFindBy.call(this, where as never);
    }

    return originalFindBy.call(this, scopeWhere(where, tenantId) as never);
  };

  const originalFindOneBy = repositoryPrototype.findOneBy;
  repositoryPrototype.findOneBy = function findOneBy(where: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalFindOneBy.call(this, where as never);
    }

    return originalFindOneBy.call(this, scopeWhere(where, tenantId) as never);
  };

  const originalUpdate = repositoryPrototype.update;
  repositoryPrototype.update = function update(criteria: unknown, partialEntity: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalUpdate.call(this, criteria as never, partialEntity as never);
    }

    return originalUpdate.call(this, scopeCriteria(criteria, tenantId) as never, partialEntity as never);
  };

  const originalDelete = repositoryPrototype.delete;
  repositoryPrototype.delete = function deleteCriteria(criteria: unknown) {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId || !hasTenantColumn(this)) {
      return originalDelete.call(this, criteria as never);
    }

    return originalDelete.call(this, scopeCriteria(criteria, tenantId) as never);
  };

  const originalCreateQueryBuilder = repositoryPrototype.createQueryBuilder;
  repositoryPrototype.createQueryBuilder = function createQueryBuilder(alias?: string) {
    const queryBuilder = originalCreateQueryBuilder.call(this, alias as never);
    const tenantId = TenantContext.getTenantId();

    if (!tenantId || !hasTenantColumn(this)) {
      return queryBuilder;
    }

    const queryType = queryBuilder.expressionMap.queryType;
    const mainAlias = queryBuilder.expressionMap.mainAlias?.name;
    if (queryType === 'select' && mainAlias) {
      queryBuilder.andWhere(`${mainAlias}.${TENANT_KEY} = :${TENANT_PARAM}`, {
        [TENANT_PARAM]: tenantId,
      });
    }

    return queryBuilder;
  };
}

@Injectable()
export class TypeOrmTenantScopeInitializer implements OnModuleInit {
  onModuleInit() {
    patchRepositoryPrototype();
  }
}
