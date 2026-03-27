const storageKeys = {
  authBase: 'omt.ui.authBase',
  organizationBase: 'omt.ui.organizationBase',
  transferBase: 'omt.ui.transferBase',
  accessToken: 'omt.ui.accessToken',
  refreshToken: 'omt.ui.refreshToken',
};

const defaults = {
  authBase: 'http://localhost:3001',
  organizationBase: 'http://localhost:3001',
  transferBase: 'http://localhost:3002/api/v1',
};

const state = {
  authBase: localStorage.getItem(storageKeys.authBase) || defaults.authBase,
  organizationBase: localStorage.getItem(storageKeys.organizationBase) || defaults.organizationBase,
  transferBase: localStorage.getItem(storageKeys.transferBase) || defaults.transferBase,
  accessToken: localStorage.getItem(storageKeys.accessToken) || '',
  refreshToken: localStorage.getItem(storageKeys.refreshToken) || '',
  claims: null,
  tenants: [],
  currencies: [],
  wallets: [],
  transferTypes: [],
  knownIds: {
    tenantId: '',
    currencyId: '',
    walletId: '',
    transferId: '',
    transferReference: '',
  },
};

const elements = {
  authBaseUrl: document.getElementById('authBaseUrl'),
  organizationBaseUrl: document.getElementById('organizationBaseUrl'),
  transferBaseUrl: document.getElementById('transferBaseUrl'),
  saveSettings: document.getElementById('saveSettings'),
  clearSession: document.getElementById('clearSession'),
  refreshDbOptions: document.getElementById('refreshDbOptions'),
  dbSyncStatus: document.getElementById('dbSyncStatus'),
  tokenStatus: document.getElementById('tokenStatus'),
  sessionSummary: document.getElementById('sessionSummary'),
  knownIds: document.getElementById('knownIds'),
  responseBox: document.getElementById('responseBox'),
  tenantSnapshot: document.getElementById('tenantSnapshot'),
  currencySnapshot: document.getElementById('currencySnapshot'),
  walletSnapshot: document.getElementById('walletSnapshot'),
  transferSnapshot: document.getElementById('transferSnapshot'),
  transferTypeOptions: document.getElementById('transferTypeOptions'),
};

const normalizeBase = (base) => (base || '').trim().replace(/\/+$/, '');

const tryParseJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const decodeJwtPayload = (token) => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const maskToken = (token) => {
  if (!token) return 'none';
  if (token.length <= 18) return token;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
};

const collectForm = (form) => Object.fromEntries(new FormData(form).entries());

const removeEmptyValues = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (typeof value === 'string') return value.trim() !== '';
      return value !== undefined && value !== null;
    }),
  );

const parseJsonOptional = (value, fieldName) => {
  if (!value || !value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }
};

const toNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`${fieldName} must be a number`);
  }
  return parsed;
};

const extractTokens = (body) => {
  if (!body || typeof body !== 'object') return null;
  if (body.accessToken || body.refreshToken) {
    return { accessToken: body.accessToken, refreshToken: body.refreshToken };
  }
  if (body.tokens && typeof body.tokens === 'object') {
    return { accessToken: body.tokens.accessToken, refreshToken: body.tokens.refreshToken };
  }
  return null;
};

const getBaseByService = (service) => {
  if (service === 'auth') return state.authBase;
  if (service === 'organization') return state.organizationBase;
  if (service === 'transfer') return state.transferBase;
  return '';
};

const makeRequest = async ({ service, path, method, body, withAuth = true, extraHeaders = {} }) => {
  const base = normalizeBase(getBaseByService(service));
  const url = `${base}${path}`;
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };

  if (withAuth && state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const init = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const text = await response.text();
  const parsed = tryParseJson(text);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    request: { method, body, withAuth, extraHeaders },
    response: parsed ?? text,
  };
};

const writeLog = (title, payload) => {
  const timestamp = new Date().toISOString();
  elements.responseBox.textContent =
    `[${timestamp}] ${title}\n\n${JSON.stringify(payload, null, 2)}`;
};

const writeSnapshot = (element, payload) => {
  element.textContent = JSON.stringify(payload, null, 2);
};

const setDbSyncStatus = (message) => {
  if (elements.dbSyncStatus) {
    elements.dbSyncStatus.textContent = message;
  }
};

const setKnownId = (key, value) => {
  if (typeof value === 'string' && value.trim()) {
    state.knownIds[key] = value.trim();
  }
};

const scanPayloadForIds = (payload) => {
  if (!payload || typeof payload !== 'object') return;

  if (Array.isArray(payload)) {
    payload.forEach((item) => scanPayloadForIds(item));
    return;
  }

  if (payload.tenant?.id) setKnownId('tenantId', payload.tenant.id);

  if (
    typeof payload.id === 'string' &&
    typeof payload.slug === 'string' &&
    Object.prototype.hasOwnProperty.call(payload, 'ownerUserId')
  ) {
    setKnownId('tenantId', payload.id);
  }

  if (
    typeof payload.id === 'string' &&
    typeof payload.symbol === 'string' &&
    Object.prototype.hasOwnProperty.call(payload, 'totalSupply')
  ) {
    setKnownId('currencyId', payload.id);
  }

  if (
    typeof payload.id === 'string' &&
    Object.prototype.hasOwnProperty.call(payload, 'userId') &&
    Object.prototype.hasOwnProperty.call(payload, 'currencyId') &&
    Object.prototype.hasOwnProperty.call(payload, 'balance')
  ) {
    setKnownId('walletId', payload.id);
    setKnownId('currencyId', payload.currencyId);
    setKnownId('tenantId', payload.tenantId);
  }

  if (typeof payload.referenceCode === 'string') {
    setKnownId('transferReference', payload.referenceCode);
    if (typeof payload.id === 'string') {
      setKnownId('transferId', payload.id);
    }
  }

  Object.values(payload).forEach((value) => {
    if (value && typeof value === 'object') {
      scanPayloadForIds(value);
    }
  });
};

const renderTenantDropdowns = () => {
  const pickers = document.querySelectorAll('select[data-tenant-picker="true"]');
  pickers.forEach((select) => {
    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select tenant (DB)';
    select.appendChild(placeholder);

    state.tenants.forEach((tenant) => {
      const option = document.createElement('option');
      option.value = tenant.id;
      option.textContent = tenant.slug ? `${tenant.name} (${tenant.slug})` : tenant.name;
      select.appendChild(option);
    });

    const preferred = previous || state.knownIds.tenantId || state.claims?.tenantId || '';
    if (preferred && state.tenants.some((tenant) => tenant.id === preferred)) {
      select.value = preferred;
    }
  });
};

const renderCurrencyIdDropdowns = () => {
  const picks = document.querySelectorAll('select[data-currency-id-picker="true"]');
  picks.forEach((select) => {
    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select currency (DB)';
    select.appendChild(placeholder);

    state.currencies.forEach((currency) => {
      const option = document.createElement('option');
      option.value = currency.id;
      option.textContent = `${currency.name} (${currency.symbol})`;
      select.appendChild(option);
    });

    const preferred = previous || state.knownIds.currencyId || '';
    if (preferred && state.currencies.some((currency) => currency.id === preferred)) {
      select.value = preferred;
    }
  });
};

const renderCurrencySymbolDropdowns = () => {
  const picks = document.querySelectorAll('select[data-currency-symbol-picker="true"]');
  const symbols = Array.from(new Set(state.currencies.map((currency) => currency.symbol).filter(Boolean))).sort();

  picks.forEach((select) => {
    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select currency symbol (DB)';
    select.appendChild(placeholder);

    symbols.forEach((symbol) => {
      const option = document.createElement('option');
      option.value = symbol;
      option.textContent = symbol;
      select.appendChild(option);
    });

    if (previous && symbols.includes(previous)) {
      select.value = previous;
    } else if (symbols.length === 1) {
      select.value = symbols[0];
    }
  });
};

const renderWalletDropdowns = () => {
  const picks = document.querySelectorAll('select[data-wallet-picker="true"]');
  picks.forEach((select) => {
    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select wallet (DB)';
    select.appendChild(placeholder);

    state.wallets.forEach((wallet) => {
      const option = document.createElement('option');
      option.value = wallet.id;
      const symbol = wallet.currency?.symbol ? ` ${wallet.currency.symbol}` : '';
      option.textContent = `${wallet.id.slice(0, 8)}... | balance=${wallet.balance}${symbol}`;
      select.appendChild(option);
    });

    const preferred = previous || state.knownIds.walletId || '';
    if (preferred && state.wallets.some((wallet) => wallet.id === preferred)) {
      select.value = preferred;
    }
  });
};

const renderTransferTypeOptions = () => {
  if (!elements.transferTypeOptions) return;
  elements.transferTypeOptions.innerHTML = '';
  state.transferTypes.forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    elements.transferTypeOptions.appendChild(option);
  });
};

const applyKnownIdsToFields = () => {
  document.querySelectorAll('[data-autofill]').forEach((field) => {
    const key = field.dataset.autofill;
    if (!key) return;

    const value = state.knownIds[key];
    if (!value) return;

    if (field.tagName === 'SELECT') {
      const hasOption = Array.from(field.options).some((option) => option.value === value);
      if (hasOption) {
        field.value = value;
      }
      return;
    }

    if (!field.value.trim()) {
      field.value = value;
    }
  });
};

const refreshKnownIdsUi = () => {
  elements.knownIds.textContent = JSON.stringify(state.knownIds, null, 2);
  applyKnownIdsToFields();
};

const getActiveTenantId = () => {
  const pickerWithValue = Array.from(document.querySelectorAll('select[data-tenant-picker="true"]')).find(
    (select) => select.value,
  );

  return (
    pickerWithValue?.value ||
    state.knownIds.tenantId ||
    state.claims?.tenantId ||
    ''
  );
};

const syncTenantsFromDb = async () => {
  if (!state.accessToken) {
    state.tenants = [];
    renderTenantDropdowns();
    return;
  }

  const result = await makeRequest({
    service: 'organization',
    path: '/tenants/my',
    method: 'GET',
  });

  if (!result.ok) {
    throw new Error(`Tenant sync failed (${result.status})`);
  }

  const rows = Array.isArray(result.response) ? result.response : [];
  state.tenants = rows.map((tenant) => ({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug || '',
  }));
  renderTenantDropdowns();
};

const syncCurrenciesForTenant = async (tenantId) => {
  if (!tenantId || !state.accessToken) {
    state.currencies = [];
    renderCurrencyIdDropdowns();
    renderCurrencySymbolDropdowns();
    return;
  }

  const result = await makeRequest({
    service: 'organization',
    path: `/tenants/${encodeURIComponent(tenantId)}/currencies`,
    method: 'GET',
  });

  if (!result.ok) {
    throw new Error(`Currency sync failed (${result.status})`);
  }

  state.currencies = Array.isArray(result.response) ? result.response : [];
  renderCurrencyIdDropdowns();
  renderCurrencySymbolDropdowns();
};

const syncWalletsForTenant = async (tenantId) => {
  if (!tenantId || !state.accessToken) {
    state.wallets = [];
    renderWalletDropdowns();
    return;
  }

  const result = await makeRequest({
    service: 'organization',
    path: '/wallets/me',
    method: 'GET',
    extraHeaders: { 'x-tenant-id': tenantId },
  });

  if (!result.ok) {
    throw new Error(`Wallet sync failed (${result.status})`);
  }

  state.wallets = Array.isArray(result.response) ? result.response : [];
  renderWalletDropdowns();
};

const syncTransferTypesFromDb = async () => {
  if (!state.accessToken) {
    state.transferTypes = [];
    renderTransferTypeOptions();
    return;
  }

  const result = await makeRequest({
    service: 'transfer',
    path: '/transfers?page=1&limit=100',
    method: 'GET',
  });

  if (!result.ok) {
    throw new Error(`Transfer type sync failed (${result.status})`);
  }

  const rows = Array.isArray(result.response?.data) ? result.response.data : [];
  state.transferTypes = Array.from(new Set(rows.map((item) => item.type).filter(Boolean))).sort();
  renderTransferTypeOptions();
};

const syncDbOptions = async ({
  tenants = false,
  currencies = false,
  wallets = false,
  transferTypes = false,
} = {}) => {
  try {
    setDbSyncStatus('Syncing values from DB...');

    if (tenants) {
      await syncTenantsFromDb();
    }

    const tenantId = getActiveTenantId();

    if (currencies) {
      await syncCurrenciesForTenant(tenantId);
    }

    if (wallets) {
      await syncWalletsForTenant(tenantId);
    }

    if (transferTypes) {
      await syncTransferTypesFromDb();
    }

    applyKnownIdsToFields();
    setDbSyncStatus(`Synced from DB at ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    setDbSyncStatus(
      `DB sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const captureKnownIds = (result) => {
  if (!result?.response || typeof result.response !== 'object') return;
  scanPayloadForIds(result.response);
  refreshKnownIdsUi();
};

const updateSessionUi = () => {
  elements.tokenStatus.textContent = `Session: ${maskToken(state.accessToken)}`;

  if (!state.claims) {
    elements.sessionSummary.textContent = 'Not logged in.';
  } else {
    elements.sessionSummary.textContent = [
      `user=${state.claims.sub || 'n/a'}`,
      `role=${state.claims.role || 'n/a'}`,
      `tenant=${state.claims.tenantId || 'n/a'}`,
      `phone=${state.claims.phone || 'n/a'}`,
    ].join(' | ');
  }

  refreshKnownIdsUi();
};

const updateSessionState = () => {
  state.claims = decodeJwtPayload(state.accessToken);
  localStorage.setItem(storageKeys.accessToken, state.accessToken || '');
  localStorage.setItem(storageKeys.refreshToken, state.refreshToken || '');
  updateSessionUi();
};

const setTokens = (accessToken, refreshToken) => {
  if (typeof accessToken === 'string' && accessToken.trim()) {
    state.accessToken = accessToken.trim();
  }
  if (typeof refreshToken === 'string' && refreshToken.trim()) {
    state.refreshToken = refreshToken.trim();
  }
  updateSessionState();
};

const clearTokens = () => {
  state.accessToken = '';
  state.refreshToken = '';
  state.claims = null;
  state.tenants = [];
  state.currencies = [];
  state.wallets = [];
  state.transferTypes = [];
  updateSessionState();
  renderTenantDropdowns();
  renderCurrencyIdDropdowns();
  renderCurrencySymbolDropdowns();
  renderWalletDropdowns();
  renderTransferTypeOptions();
  setDbSyncStatus('Waiting for authenticated session.');
};

const run = async (title, requestFactory, onSuccess) => {
  try {
    const result = await requestFactory();
    captureKnownIds(result);

    if (result.ok && typeof onSuccess === 'function') {
      await onSuccess(result);
    }

    writeLog(title, result);
  } catch (error) {
    writeLog(title, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const bindSubmit = (id, handler) => {
  const form = document.getElementById(id);
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handler(form);
  });
};

const bindTenantPickerEvents = () => {
  document.querySelectorAll('select[data-tenant-picker="true"]').forEach((select) => {
    select.addEventListener('change', async () => {
      if (select.value) {
        setKnownId('tenantId', select.value);
        refreshKnownIdsUi();
      }

      await syncDbOptions({ currencies: true, wallets: true });
    });
  });
};

const initialize = () => {
  elements.authBaseUrl.value = state.authBase;
  elements.organizationBaseUrl.value = state.organizationBase;
  elements.transferBaseUrl.value = state.transferBase;

  renderTenantDropdowns();
  renderCurrencyIdDropdowns();
  renderCurrencySymbolDropdowns();
  renderWalletDropdowns();
  renderTransferTypeOptions();
  updateSessionState();
  setDbSyncStatus('Waiting for authenticated session.');

  elements.saveSettings.addEventListener('click', () => {
    state.authBase = normalizeBase(elements.authBaseUrl.value) || defaults.authBase;
    state.organizationBase =
      normalizeBase(elements.organizationBaseUrl.value) || defaults.organizationBase;
    state.transferBase = normalizeBase(elements.transferBaseUrl.value) || defaults.transferBase;

    localStorage.setItem(storageKeys.authBase, state.authBase);
    localStorage.setItem(storageKeys.organizationBase, state.organizationBase);
    localStorage.setItem(storageKeys.transferBase, state.transferBase);

    writeLog('Saved targets', {
      authBase: state.authBase,
      organizationBase: state.organizationBase,
      transferBase: state.transferBase,
    });
  });

  elements.clearSession.addEventListener('click', () => {
    clearTokens();
    writeLog('Session cleared', {});
  });

  if (elements.refreshDbOptions) {
    elements.refreshDbOptions.addEventListener('click', async () => {
      await run('Refresh DB options', async () => ({ ok: true, response: {} }), async () => {
        await syncDbOptions({
          tenants: true,
          currencies: true,
          wallets: true,
          transferTypes: true,
        });
      });
    });
  }

  bindSubmit('createTenantAdminForm', (form) =>
    run(
      'Create tenant + admin (public)',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'auth',
          path: '/tenants',
          method: 'POST',
          body: values,
          withAuth: false,
        });
      },
      async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken);
        }

        if (result.response?.tenant) {
          writeSnapshot(elements.tenantSnapshot, result.response.tenant);
        }

        await syncDbOptions({ tenants: true });
      },
    ),
  );

  bindSubmit('registerForm', (form) =>
    run('Register normal user', async () =>
      makeRequest({
        service: 'auth',
        path: '/auth/register',
        method: 'POST',
        body: removeEmptyValues(collectForm(form)),
        withAuth: false,
      }),
    ),
  );

  bindSubmit('verifyEmailForm', (form) =>
    run('Verify email', async () =>
      makeRequest({
        service: 'auth',
        path: '/auth/verify-email',
        method: 'POST',
        body: removeEmptyValues(collectForm(form)),
        withAuth: false,
      }),
    ),
  );

  bindSubmit('resendOtpForm', (form) =>
    run('Resend OTP', async () =>
      makeRequest({
        service: 'auth',
        path: '/auth/resend-otp',
        method: 'POST',
        body: removeEmptyValues(collectForm(form)),
        withAuth: false,
      }),
    ),
  );

  bindSubmit('loginForm', (form) =>
    run(
      'Login',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'auth',
          path: '/auth/login',
          method: 'POST',
          body: values,
          withAuth: false,
        });
      },
      async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken);
        }
        await syncDbOptions({ tenants: true });
      },
    ),
  );

  bindSubmit('refreshForm', (form) =>
    run(
      'Refresh token',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        const refreshToken = values.refreshToken || state.refreshToken;

        return makeRequest({
          service: 'auth',
          path: '/auth/refresh',
          method: 'POST',
          body: { refreshToken },
          withAuth: false,
        });
      },
      async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken || state.refreshToken);
        }
        await syncDbOptions({ tenants: true });
      },
    ),
  );

  bindSubmit('logoutForm', () =>
    run(
      'Logout',
      async () =>
        makeRequest({
          service: 'auth',
          path: '/auth/logout',
          method: 'POST',
        }),
      async (result) => {
        if (result.ok) {
          clearTokens();
        }
      },
    ),
  );

  bindSubmit('getTenantForm', (form) =>
    run('Get tenant settings', async () => {
      const values = removeEmptyValues(collectForm(form));
      const result = await makeRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(values.tenantId)}`,
        method: 'GET',
      });
      if (result.ok) {
        writeSnapshot(elements.tenantSnapshot, result.response);
      }
      return result;
    }),
  );

  bindSubmit('updateTenantForm', (form) =>
    run(
      'Update tenant settings',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        const tenantId = values.tenantId;
        delete values.tenantId;

        return makeRequest({
          service: 'organization',
          path: `/tenants/${encodeURIComponent(tenantId)}`,
          method: 'PATCH',
          body: values,
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.tenantSnapshot, result.response);
        }
        await syncDbOptions({ tenants: true });
      },
    ),
  );

  bindSubmit('createCurrencyForm', (form) =>
    run(
      'Create currency',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        const tenantId = values.tenantId;
        const earnRules = parseJsonOptional(values.earnRules, 'earnRules');

        const body = {
          name: values.name,
          symbol: values.symbol,
          initialSupply: toNumber(values.initialSupply, 'initialSupply'),
        };

        if (values.color) body.color = values.color;
        if (values.expiryDays) body.expiryDays = toNumber(values.expiryDays, 'expiryDays');
        if (earnRules !== undefined) body.earnRules = earnRules;

        return makeRequest({
          service: 'organization',
          path: `/tenants/${encodeURIComponent(tenantId)}/currencies`,
          method: 'POST',
          body,
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.currencySnapshot, result.response);
        }
        await syncDbOptions({ currencies: true });
      },
    ),
  );

  bindSubmit('listCurrenciesForm', (form) =>
    run(
      'List currencies',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'organization',
          path: `/tenants/${encodeURIComponent(values.tenantId)}/currencies`,
          method: 'GET',
        });
      },
      async (result) => {
        if (result.ok) {
          state.currencies = Array.isArray(result.response) ? result.response : [];
          renderCurrencyIdDropdowns();
          renderCurrencySymbolDropdowns();
          writeSnapshot(elements.currencySnapshot, result.response);
        }
      },
    ),
  );

  bindSubmit('getCurrencyForm', (form) =>
    run('Get currency', async () => {
      const values = removeEmptyValues(collectForm(form));
      const result = await makeRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(values.tenantId)}/currencies/${encodeURIComponent(values.currencyId)}`,
        method: 'GET',
      });
      if (result.ok) {
        writeSnapshot(elements.currencySnapshot, result.response);
      }
      return result;
    }),
  );

  bindSubmit('addWalletForm', (form) =>
    run(
      'Add wallet',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'organization',
          path: `/tenants/${encodeURIComponent(values.tenantId)}/currencies/${encodeURIComponent(values.currencyId)}/members`,
          method: 'POST',
          body: { userId: values.userId },
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.walletSnapshot, result.response);
        }
        await syncDbOptions({ wallets: true });
      },
    ),
  );

  bindSubmit('myWalletsForm', (form) =>
    run(
      'Get my wallets',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'organization',
          path: '/wallets/me',
          method: 'GET',
          extraHeaders: { 'x-tenant-id': values.tenantId },
        });
      },
      async (result) => {
        if (result.ok) {
          state.wallets = Array.isArray(result.response) ? result.response : [];
          renderWalletDropdowns();
          writeSnapshot(elements.walletSnapshot, result.response);
        }
      },
    ),
  );

  bindSubmit('mintTokensForm', (form) =>
    run(
      'Mint tokens',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        const body = {
          membershipId: values.walletId,
          amount: toNumber(values.amount, 'amount'),
        };
        if (values.reason) body.reason = values.reason;

        return makeRequest({
          service: 'organization',
          path: `/tenants/${encodeURIComponent(values.tenantId)}/mint`,
          method: 'POST',
          body,
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.walletSnapshot, result.response);
        }
        await syncDbOptions({ wallets: true, currencies: true });
      },
    ),
  );

  bindSubmit('createTransferForm', (form) =>
    run(
      'Create transfer',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        values.amount = toNumber(values.amount, 'amount');

        return makeRequest({
          service: 'transfer',
          path: '/transfers',
          method: 'POST',
          body: values,
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.transferSnapshot, result.response);
        }
        await syncTransferTypesFromDb();
      },
    ),
  );

  bindSubmit('listTransfersForm', (form) =>
    run(
      'List transfers',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        const page = toNumber(values.page || 1, 'page');
        const limit = toNumber(values.limit || 20, 'limit');

        return makeRequest({
          service: 'transfer',
          path: `/transfers?page=${page}&limit=${limit}`,
          method: 'GET',
        });
      },
      async (result) => {
        if (result.ok) {
          const rows = Array.isArray(result.response?.data) ? result.response.data : [];
          state.transferTypes = Array.from(new Set(rows.map((item) => item.type).filter(Boolean))).sort();
          renderTransferTypeOptions();
          writeSnapshot(elements.transferSnapshot, result.response);
        }
      },
    ),
  );

  bindSubmit('getTransferForm', (form) =>
    run('Get transfer by reference', async () => {
      const values = removeEmptyValues(collectForm(form));
      const result = await makeRequest({
        service: 'transfer',
        path: `/transfers/${encodeURIComponent(values.reference)}`,
        method: 'GET',
      });
      if (result.ok) {
        writeSnapshot(elements.transferSnapshot, result.response);
      }
      return result;
    }),
  );

  bindSubmit('cancelTransferForm', (form) =>
    run(
      'Cancel transfer',
      async () => {
        const values = removeEmptyValues(collectForm(form));
        return makeRequest({
          service: 'transfer',
          path: `/transfers/${encodeURIComponent(values.id)}/cancel`,
          method: 'PATCH',
        });
      },
      async (result) => {
        if (result.ok) {
          writeSnapshot(elements.transferSnapshot, result.response);
        }
        await syncTransferTypesFromDb();
      },
    ),
  );

  bindTenantPickerEvents();

  if (state.accessToken) {
    syncDbOptions({ tenants: true });
  }
};

initialize();
