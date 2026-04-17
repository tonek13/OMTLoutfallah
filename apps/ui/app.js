const storageKeys = {
  authBase: 'omt.ui.authBase',
  organizationBase: 'omt.ui.organizationBase',
  transferBase: 'omt.ui.transferBase',
  accessToken: 'omt.ui.accessToken',
  refreshToken: 'omt.ui.refreshToken',
};

const localDefaults = {
  authBase: 'http://localhost:3001',
  organizationBase: 'http://localhost:3001',
  transferBase: 'http://localhost:3002/api/v1',
};

const hostedDefaults = {
  authBase: 'https://omt-auth-service.onrender.com',
  organizationBase: 'https://omt-auth-service.onrender.com',
  transferBase: 'https://omt-transfer-service.onrender.com/api/v1',
};

const isHostedUi = window.location.hostname.endsWith('onrender.com');
const defaults = isHostedUi ? hostedDefaults : localDefaults;

const readBaseSetting = (key, fallback) => {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;

  if (isHostedUi && /^http:\/\/localhost(:\d+)?/i.test(stored)) {
    localStorage.setItem(key, fallback);
    return fallback;
  }

  return stored;
};

const state = {
  authBase: readBaseSetting(storageKeys.authBase, defaults.authBase),
  organizationBase: readBaseSetting(storageKeys.organizationBase, defaults.organizationBase),
  transferBase: readBaseSetting(storageKeys.transferBase, defaults.transferBase),
  accessToken: localStorage.getItem(storageKeys.accessToken) || '',
  refreshToken: localStorage.getItem(storageKeys.refreshToken) || '',
  claims: null,
  logs: [],
  tenants: [],
  currencies: [],
  wallets: [],
  transfers: [],
  transferMeta: null,
  currencyTransactions: [],
  currencyTransactionsMeta: null,
  currencyStats: null,
  knownIds: {
    tenantId: '',
    currencyId: '',
    walletId: '',
    transferId: '',
    transferReference: '',
    userId: '',
  },
};

const elements = {
  // navigation and layout
  viewNav: document.getElementById('viewNav'),
  views: Array.from(document.querySelectorAll('.view')),
  viewTabs: Array.from(document.querySelectorAll('.view-tab')),
  settingsPanel: document.getElementById('settingsPanel'),
  toggleSettingsBtn: document.getElementById('toggleSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  syncAllBtn: document.getElementById('syncAllBtn'),
  clearSessionBtn: document.getElementById('clearSessionBtn'),
  flashMessage: document.getElementById('flashMessage'),

  // service targets
  authBaseUrl: document.getElementById('authBaseUrl'),
  organizationBaseUrl: document.getElementById('organizationBaseUrl'),
  transferBaseUrl: document.getElementById('transferBaseUrl'),

  // session and console
  sessionBadge: document.getElementById('sessionBadge'),
  sessionClaims: document.getElementById('sessionClaims'),
  responseLog: document.getElementById('responseLog'),
  knownIds: document.getElementById('knownIds'),

  // snapshots
  tenantSnapshot: document.getElementById('tenantSnapshot'),
  currencySnapshot: document.getElementById('currencySnapshot'),
  walletSnapshot: document.getElementById('walletSnapshot'),
  transferSnapshot: document.getElementById('transferSnapshot'),

  // tenant table
  loadTenantsBtn: document.getElementById('loadTenantsBtn'),
  tenantsTableBody: document.getElementById('tenantsTableBody'),

  // currency table/actions
  loadCurrenciesBtn: document.getElementById('loadCurrenciesBtn'),
  loadCurrencyLegacyBtn: document.getElementById('loadCurrencyLegacyBtn'),
  loadCurrencyViewBtn: document.getElementById('loadCurrencyViewBtn'),
  currenciesTableBody: document.getElementById('currenciesTableBody'),
  currencyActionsForm: document.getElementById('currencyActionsForm'),

  // currency stats/transactions
  loadCurrencyStatsBtn: document.getElementById('loadCurrencyStatsBtn'),
  metricTotalMinted: document.getElementById('metricTotalMinted'),
  metricTotalBurned: document.getElementById('metricTotalBurned'),
  metricTotalTransfers: document.getElementById('metricTotalTransfers'),
  metricActiveWallets: document.getElementById('metricActiveWallets'),
  dailyVolumeChart: document.getElementById('dailyVolumeChart'),
  loadCurrencyTransactionsBtn: document.getElementById('loadCurrencyTransactionsBtn'),
  transactionTypeFilter: document.getElementById('transactionTypeFilter'),
  transactionPageInput: document.getElementById('transactionPageInput'),
  transactionLimitInput: document.getElementById('transactionLimitInput'),
  transactionsMeta: document.getElementById('transactionsMeta'),
  currencyTransactionsBody: document.getElementById('currencyTransactionsBody'),

  // wallets
  walletTenantSelect: document.getElementById('walletTenantSelect'),
  loadWalletsBtn: document.getElementById('loadWalletsBtn'),
  walletsTableBody: document.getElementById('walletsTableBody'),

  // transfers
  loadTransfersBtn: document.getElementById('loadTransfersBtn'),
  transferPageInput: document.getElementById('transferPageInput'),
  transferLimitInput: document.getElementById('transferLimitInput'),
  transfersMeta: document.getElementById('transfersMeta'),
  transfersTableBody: document.getElementById('transfersTableBody'),

  // forms
  createTenantForm: document.getElementById('createTenantForm'),
  registerUserForm: document.getElementById('registerUserForm'),
  verifyEmailForm: document.getElementById('verifyEmailForm'),
  resendOtpForm: document.getElementById('resendOtpForm'),
  loginForm: document.getElementById('loginForm'),
  refreshTokenForm: document.getElementById('refreshTokenForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  getTenantForm: document.getElementById('getTenantForm'),
  updateTenantForm: document.getElementById('updateTenantForm'),
  createCurrencyForm: document.getElementById('createCurrencyForm'),
  updateCurrencyForm: document.getElementById('updateCurrencyForm'),
  addMemberWalletForm: document.getElementById('addMemberWalletForm'),
  mintCurrencyForm: document.getElementById('mintCurrencyForm'),
  burnCurrencyForm: document.getElementById('burnCurrencyForm'),
  legacyMintForm: document.getElementById('legacyMintForm'),
  createTransferForm: document.getElementById('createTransferForm'),
  getTransferForm: document.getElementById('getTransferForm'),
  cancelTransferForm: document.getElementById('cancelTransferForm'),
};

const getTenantSelects = () => Array.from(document.querySelectorAll('select[data-tenant-select]'));
const getCurrencySelects = () => Array.from(document.querySelectorAll('select[data-currency-select]'));
const getWalletSelects = () => Array.from(document.querySelectorAll('select[data-wallet-select]'));

const normalizeBase = (value) => (value || '').trim().replace(/\/+$/, '');
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isAdminRole = (role) => ['tenant_admin', 'admin', 'superadmin'].includes((role || '').toLowerCase());

const tryParseJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttr = (value) => escapeHtml(String(value ?? '').replace(/`/g, ''));

const collectForm = (form) => Object.fromEntries(new FormData(form).entries());

const removeEmptyValues = (payload) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (typeof value === 'string') return value.trim() !== '';
      return value !== undefined && value !== null;
    }),
  );

const parseJsonObjectOptional = (value, fieldName) => {
  if (!isNonEmptyString(value)) return undefined;
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${fieldName} must be valid JSON`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }
  return parsed;
};

const parsePositiveNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return parsed;
};

const parsePage = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

const parseLimit = (value, fallback = 20) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return fallback;
  return parsed;
};

const parseExpiryDaysUpdate = (value) => {
  if (!isNonEmptyString(value)) return undefined;
  if (value.trim().toLowerCase() === 'null') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('expiryDays must be an integer >= 1 or "null"');
  }
  return parsed;
};

const parseExpiryDaysCreate = (value) => {
  if (!isNonEmptyString(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('expiryDays must be an integer >= 1');
  }
  return parsed;
};

const formatNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const prettyJson = (value) => JSON.stringify(value, null, 2);

const maskToken = (token) => {
  if (!token) return 'No active token';
  if (token.length < 24) return token;
  return `${token.slice(0, 12)}...${token.slice(-8)}`;
};

const getServiceBase = (service) => {
  if (service === 'auth') return state.authBase;
  if (service === 'organization') return state.organizationBase;
  if (service === 'transfer') return state.transferBase;
  return '';
};

const extractTokens = (payload) => {
  if (!payload || typeof payload !== 'object') return null;

  if (isNonEmptyString(payload.accessToken) || isNonEmptyString(payload.refreshToken)) {
    return {
      accessToken: payload.accessToken || '',
      refreshToken: payload.refreshToken || '',
    };
  }

  if (payload.tokens && typeof payload.tokens === 'object') {
    return {
      accessToken: payload.tokens.accessToken || '',
      refreshToken: payload.tokens.refreshToken || '',
    };
  }

  return null;
};

const extractErrorMessage = (responseBody) => {
  if (!responseBody) return '';
  if (typeof responseBody === 'string') return responseBody;
  if (Array.isArray(responseBody?.message)) return responseBody.message.join(', ');
  if (isNonEmptyString(responseBody?.message)) return responseBody.message;
  if (isNonEmptyString(responseBody?.error)) return responseBody.error;
  return '';
};

const setFlash = (message, tone = 'info') => {
  if (!elements.flashMessage) return;
  const safeMessage = message || 'Ready.';
  const className = tone === 'error' ? 'flash-message error' : tone === 'warn' ? 'flash-message warn' : 'flash-message';
  elements.flashMessage.className = className;
  elements.flashMessage.textContent = safeMessage;
};

const writeLog = (title, payload) => {
  const entry = {
    at: new Date().toISOString(),
    title,
    payload,
  };
  state.logs.unshift(entry);
  state.logs = state.logs.slice(0, 40);
  if (!elements.responseLog) return;

  elements.responseLog.textContent = state.logs
    .map((item) => `[${item.at}] ${item.title}\n${prettyJson(item.payload)}`)
    .join('\n\n');
};

const writeSnapshot = (target, payload) => {
  if (!target) return;
  target.textContent = prettyJson(payload);
};

const setKnownId = (key, value) => {
  if (!Object.prototype.hasOwnProperty.call(state.knownIds, key)) return;
  if (!isNonEmptyString(value)) return;
  state.knownIds[key] = value.trim();
};

const captureKnownIds = (payload) => {
  if (!payload || typeof payload !== 'object') return;

  if (Array.isArray(payload)) {
    payload.forEach((item) => captureKnownIds(item));
    return;
  }

  const record = payload;

  if (isNonEmptyString(record?.tenantId)) setKnownId('tenantId', record.tenantId);
  if (isNonEmptyString(record?.currencyId)) setKnownId('currencyId', record.currencyId);
  if (isNonEmptyString(record?.userId)) setKnownId('userId', record.userId);
  if (isNonEmptyString(record?.ownerUserId)) setKnownId('userId', record.ownerUserId);
  if (isNonEmptyString(record?.recipientId)) setKnownId('userId', record.recipientId);
  if (isNonEmptyString(record?.referenceCode)) setKnownId('transferReference', record.referenceCode);
  if (isNonEmptyString(record?.id) && isNonEmptyString(record?.referenceCode)) {
    setKnownId('transferId', record.id);
  }

  if (
    isNonEmptyString(record?.id)
    && isNonEmptyString(record?.slug)
    && Object.prototype.hasOwnProperty.call(record, 'ownerUserId')
  ) {
    setKnownId('tenantId', record.id);
  }

  if (
    isNonEmptyString(record?.id)
    && isNonEmptyString(record?.symbol)
    && Object.prototype.hasOwnProperty.call(record, 'totalSupply')
  ) {
    setKnownId('currencyId', record.id);
  }

  if (
    isNonEmptyString(record?.id)
    && Object.prototype.hasOwnProperty.call(record, 'balance')
    && isNonEmptyString(record?.currencyId)
  ) {
    setKnownId('walletId', record.id);
  }

  if (
    isNonEmptyString(record?.id)
    && isNonEmptyString(record?.email)
    && isNonEmptyString(record?.phone)
    && isNonEmptyString(record?.tenantId)
  ) {
    setKnownId('userId', record.id);
  }

  Object.values(record).forEach((value) => {
    if (value && typeof value === 'object') captureKnownIds(value);
  });
};

const renderKnownIds = () => {
  if (!elements.knownIds) return;
  elements.knownIds.textContent = prettyJson(state.knownIds);
};

const applyContextToInputs = () => {
  const knownUserId = state.knownIds.userId || state.claims?.sub || '';
  const knownTransferRef = state.knownIds.transferReference;
  const knownTransferId = state.knownIds.transferId;
  const refreshTextarea = elements.refreshTokenForm?.querySelector('textarea[name="refreshToken"]');

  const userTargets = [
    'input[name="userId"]',
    'input[name="recipientId"]',
  ];

  userTargets.forEach((selector) => {
    document.querySelectorAll(selector).forEach((field) => {
      if (knownUserId && !field.value.trim()) {
        field.value = knownUserId;
      }
    });
  });

  const transferRefInput = elements.getTransferForm?.querySelector('input[name="reference"]');
  if (transferRefInput && knownTransferRef && !transferRefInput.value.trim()) {
    transferRefInput.value = knownTransferRef;
  }

  const transferIdInput = elements.cancelTransferForm?.querySelector('input[name="id"]');
  if (transferIdInput && knownTransferId && !transferIdInput.value.trim()) {
    transferIdInput.value = knownTransferId;
  }

  if (refreshTextarea && state.refreshToken && !refreshTextarea.value.trim()) {
    refreshTextarea.value = state.refreshToken;
  }
};

const updateSessionUi = () => {
  state.claims = decodeJwtPayload(state.accessToken);

  if (state.claims?.sub) setKnownId('userId', state.claims.sub);
  if (state.claims?.tenantId) setKnownId('tenantId', state.claims.tenantId);

  if (elements.sessionBadge) {
    if (!state.accessToken) {
      elements.sessionBadge.textContent = 'No active token';
    } else {
      const role = state.claims?.role || 'unknown';
      const tenant = state.claims?.tenantId || 'unknown-tenant';
      elements.sessionBadge.textContent = `${role} | ${tenant} | ${maskToken(state.accessToken)}`;
    }
  }

  if (elements.sessionClaims) {
    elements.sessionClaims.textContent = state.claims ? prettyJson(state.claims) : 'No active claims.';
  }

  applyRoleVisibility();
  renderKnownIds();
  applyContextToInputs();
};

const setTokens = (accessToken, refreshToken) => {
  if (isNonEmptyString(accessToken)) state.accessToken = accessToken.trim();
  if (isNonEmptyString(refreshToken)) state.refreshToken = refreshToken.trim();

  localStorage.setItem(storageKeys.accessToken, state.accessToken || '');
  localStorage.setItem(storageKeys.refreshToken, state.refreshToken || '');
  updateSessionUi();
  openView(getPreferredView());
};

const clearSession = () => {
  state.accessToken = '';
  state.refreshToken = '';
  state.claims = null;
  state.tenants = [];
  state.currencies = [];
  state.wallets = [];
  state.transfers = [];
  state.transferMeta = null;
  state.currencyTransactions = [];
  state.currencyTransactionsMeta = null;
  state.currencyStats = null;
  state.knownIds = {
    tenantId: '',
    currencyId: '',
    walletId: '',
    transferId: '',
    transferReference: '',
    userId: '',
  };

  localStorage.removeItem(storageKeys.accessToken);
  localStorage.removeItem(storageKeys.refreshToken);

  renderTenantsTable();
  renderCurrenciesTable();
  renderWalletsTable();
  renderTransfersTable();
  renderCurrencyTransactionsTable();
  renderCurrencyMetrics();
  renderTransferMeta();
  renderTransactionsMeta();
  renderTenantSelects();
  renderCurrencySelects();
  renderWalletSelects();
  updateSessionUi();
  openView(getPreferredView());
};

const apiRequest = async ({
  service,
  path,
  method = 'GET',
  body,
  withAuth = true,
  headers = {},
}) => {
  const base = normalizeBase(getServiceBase(service));
  if (!base) throw new Error(`Base URL is missing for ${service}`);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (withAuth && state.accessToken) {
    requestHeaders.Authorization = `Bearer ${state.accessToken}`;
  }

  const init = {
    method,
    headers: requestHeaders,
  };

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
    request: {
      service,
      path,
      method,
      body,
      withAuth,
      headers,
    },
    response: parsed ?? text,
  };
};

const runAction = async (title, requestFactory, { onSuccess } = {}) => {
  try {
    const result = await requestFactory();
    writeLog(title, result);

    if (result.response && typeof result.response === 'object') {
      captureKnownIds(result.response);
      renderKnownIds();
    }

    if (result.ok) {
      if (typeof onSuccess === 'function') {
        await onSuccess(result);
      }
      setFlash(`${title} succeeded.`, 'info');
    } else {
      const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
      setFlash(`${title} failed: ${details}`, 'error');
    }

    applyContextToInputs();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLog(title, { ok: false, error: message });
    setFlash(`${title} failed: ${message}`, 'error');
    return { ok: false, error: message };
  }
};

const getActiveTenantId = () =>
  state.knownIds.tenantId || state.claims?.tenantId || state.tenants[0]?.id || '';

const getActiveCurrencyId = () => state.knownIds.currencyId || state.currencies[0]?.id || '';

const renderSelectOptions = (
  select,
  rows,
  {
    placeholder,
    valueKey = 'id',
    labelBuilder = (row) => row.id,
    preferredValue = '',
  },
) => {
  if (!select) return;
  const previousValue = preferredValue || select.value;
  select.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  rows.forEach((row) => {
    const option = document.createElement('option');
    option.value = row[valueKey];
    option.textContent = labelBuilder(row);
    select.appendChild(option);
  });

  if (previousValue) {
    const exists = rows.some((row) => row[valueKey] === previousValue);
    if (exists) {
      select.value = previousValue;
    }
  }
};

function renderTenantSelects() {
  const tenantRows = state.tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.name || tenant.slug || tenant.id,
    slug: tenant.slug || '',
  }));

  const preferredTenant = state.knownIds.tenantId || state.claims?.tenantId || '';

  getTenantSelects().forEach((select) => {
    renderSelectOptions(select, tenantRows, {
      placeholder: 'Select tenant',
      valueKey: 'id',
      preferredValue: preferredTenant,
      labelBuilder: (tenant) => {
        if (tenant.slug) return `${tenant.name} (${tenant.slug})`;
        return tenant.name;
      },
    });

    // Keep token tenant selectable even if tenants are not loaded yet.
    if (!select.value && isNonEmptyString(preferredTenant)) {
      const option = document.createElement('option');
      option.value = preferredTenant;
      option.textContent = `Current Tenant (${preferredTenant.slice(0, 8)}...)`;
      select.appendChild(option);
      select.value = preferredTenant;
    }
  });
}

function renderCurrencySelects() {
  const currencyRows = state.currencies.map((currency) => ({
    id: currency.id,
    symbol: currency.symbol || '',
    name: currency.name || currency.id,
  }));

  const preferredCurrency = state.knownIds.currencyId || '';

  getCurrencySelects().forEach((select) => {
    renderSelectOptions(select, currencyRows, {
      placeholder: 'Select currency',
      valueKey: 'id',
      preferredValue: preferredCurrency,
      labelBuilder: (currency) => `${currency.name} (${currency.symbol || 'n/a'})`,
    });

    if (!select.value && isNonEmptyString(preferredCurrency)) {
      const option = document.createElement('option');
      option.value = preferredCurrency;
      option.textContent = `Selected Currency (${preferredCurrency.slice(0, 8)}...)`;
      select.appendChild(option);
      select.value = preferredCurrency;
    }
  });
}

function renderWalletSelects() {
  const walletRows = state.wallets.map((wallet) => ({
    id: wallet.id,
    currencySymbol: wallet.currency?.symbol || '',
    balance: wallet.balance,
  }));

  const preferredWallet = state.knownIds.walletId || '';

  getWalletSelects().forEach((select) => {
    renderSelectOptions(select, walletRows, {
      placeholder: 'Select wallet',
      valueKey: 'id',
      preferredValue: preferredWallet,
      labelBuilder: (wallet) => `${wallet.id.slice(0, 8)}... | ${formatNumber(wallet.balance)} ${wallet.currencySymbol}`,
    });

    if (!select.value && isNonEmptyString(preferredWallet)) {
      const option = document.createElement('option');
      option.value = preferredWallet;
      option.textContent = `Selected Wallet (${preferredWallet.slice(0, 8)}...)`;
      select.appendChild(option);
      select.value = preferredWallet;
    }
  });
}

function renderTenantsTable() {
  if (!elements.tenantsTableBody) return;

  if (!state.tenants.length) {
    elements.tenantsTableBody.innerHTML = '<tr><td colspan="4">No tenants loaded.</td></tr>';
    return;
  }

  elements.tenantsTableBody.innerHTML = state.tenants
    .map(
      (tenant) => `
        <tr>
          <td>${escapeHtml(tenant.name || '-')}</td>
          <td>${escapeHtml(tenant.slug || '-')}</td>
          <td class="code">${escapeHtml(tenant.id)}</td>
          <td><button class="btn btn-ghost" type="button" data-select-tenant="${escapeAttr(tenant.id)}">Select</button></td>
        </tr>
      `,
    )
    .join('');
}

function renderCurrenciesTable() {
  if (!elements.currenciesTableBody) return;

  if (!state.currencies.length) {
    elements.currenciesTableBody.innerHTML = '<tr><td colspan="6">No currencies loaded.</td></tr>';
    return;
  }

  elements.currenciesTableBody.innerHTML = state.currencies
    .map(
      (currency) => `
        <tr>
          <td>${escapeHtml(currency.name || '-')}</td>
          <td>${escapeHtml(currency.symbol || '-')}</td>
          <td>${escapeHtml(formatNumber(currency.circulatingSupply))}</td>
          <td>${escapeHtml(formatNumber(currency.totalSupply))}</td>
          <td class="code">${escapeHtml(currency.id)}</td>
          <td><button class="btn btn-ghost" type="button" data-select-currency="${escapeAttr(currency.id)}">Select</button></td>
        </tr>
      `,
    )
    .join('');
}

function renderWalletsTable() {
  if (!elements.walletsTableBody) return;

  if (!state.wallets.length) {
    elements.walletsTableBody.innerHTML = '<tr><td colspan="5">No wallets loaded.</td></tr>';
    return;
  }

  elements.walletsTableBody.innerHTML = state.wallets
    .map(
      (wallet) => `
        <tr>
          <td>${escapeHtml(wallet.currency?.symbol || wallet.currency?.name || '-') }</td>
          <td class="code">${escapeHtml(wallet.id)}</td>
          <td>${escapeHtml(formatNumber(wallet.balance))}</td>
          <td>${escapeHtml(formatNumber(wallet.frozenBalance))}</td>
          <td><button class="btn btn-ghost" type="button" data-select-wallet="${escapeAttr(wallet.id)}">Select</button></td>
        </tr>
      `,
    )
    .join('');
}

function renderTransferMeta(meta = state.transferMeta) {
  if (!elements.transfersMeta) return;
  if (!meta) {
    elements.transfersMeta.textContent = 'No data.';
    return;
  }
  elements.transfersMeta.textContent = `Page ${meta.page} of ${meta.pages} | total ${meta.total}`;
}

function renderTransfersTable() {
  if (!elements.transfersTableBody) return;

  if (!state.transfers.length) {
    elements.transfersTableBody.innerHTML = '<tr><td colspan="7">No transfers loaded.</td></tr>';
    return;
  }

  elements.transfersTableBody.innerHTML = state.transfers
    .map(
      (transfer) => `
        <tr>
          <td class="code">${escapeHtml(transfer.referenceCode || '-')}</td>
          <td>${escapeHtml(transfer.status || '-')}</td>
          <td>${escapeHtml(formatNumber(transfer.totalAmount ?? transfer.amount))} ${escapeHtml(transfer.currency || '')}</td>
          <td>${escapeHtml(transfer.type || '-')}</td>
          <td>${escapeHtml(transfer.receiverName || '-') }</td>
          <td>${escapeHtml(formatDateTime(transfer.createdAt))}</td>
          <td>
            <button
              class="btn btn-ghost"
              type="button"
              data-bind-transfer-id="${escapeAttr(transfer.id || '')}"
              data-bind-transfer-ref="${escapeAttr(transfer.referenceCode || '')}"
            >
              Bind
            </button>
          </td>
        </tr>
      `,
    )
    .join('');
}

function renderTransactionsMeta(meta = state.currencyTransactionsMeta) {
  if (!elements.transactionsMeta) return;
  if (!meta) {
    elements.transactionsMeta.textContent = 'No data.';
    return;
  }
  elements.transactionsMeta.textContent = `Page ${meta.page} of ${meta.pages} | total ${meta.total}`;
}

function renderCurrencyTransactionsTable(rows = state.currencyTransactions) {
  if (!elements.currencyTransactionsBody) return;

  if (!rows.length) {
    elements.currencyTransactionsBody.innerHTML = '<tr><td colspan="5">No transactions loaded.</td></tr>';
    return;
  }

  elements.currencyTransactionsBody.innerHTML = rows
    .map((item) => {
      const actorLabel = item.actor?.phone || item.actor?.email || item.actor?.id || '-';
      return `
        <tr>
          <td>${escapeHtml(item.type || '-')}</td>
          <td>${escapeHtml(actorLabel)}</td>
          <td>${escapeHtml(formatNumber(item.amount))}</td>
          <td>${escapeHtml(item.reason || '-')}</td>
          <td>${escapeHtml(formatDateTime(item.timestamp))}</td>
        </tr>
      `;
    })
    .join('');
}

function renderCurrencyMetrics(stats = state.currencyStats) {
  const metricFallback = '0';
  if (elements.metricTotalMinted) elements.metricTotalMinted.textContent = stats ? formatNumber(stats.totalMinted) : metricFallback;
  if (elements.metricTotalBurned) elements.metricTotalBurned.textContent = stats ? formatNumber(stats.totalBurned) : metricFallback;
  if (elements.metricTotalTransfers) elements.metricTotalTransfers.textContent = stats ? formatNumber(stats.totalTransfers) : metricFallback;
  if (elements.metricActiveWallets) elements.metricActiveWallets.textContent = stats ? formatNumber(stats.activeWallets) : metricFallback;

  renderDailyVolumeChart(stats?.dailyVolume || []);
}

function renderDailyVolumeChart(points) {
  if (!elements.dailyVolumeChart) return;

  const rows = Array.isArray(points) ? points.slice(-30) : [];
  if (!rows.length) {
    elements.dailyVolumeChart.innerHTML = '<div class="hint">No daily volume data.</div>';
    return;
  }

  const values = rows.map((row) => Number(row.volume) || 0);
  const maxValue = Math.max(...values, 1);
  elements.dailyVolumeChart.innerHTML = rows
    .map((row) => {
      const value = Number(row.volume) || 0;
      const barHeight = Math.max(4, Math.round((value / maxValue) * 120));
      const tooltip = `${row.date}: ${formatNumber(value)}`;
      return `<div class="volume-bar" style="--bar-height:${barHeight}px" data-tip="${escapeAttr(tooltip)}"></div>`;
    })
    .join('');
}

const refreshContextUi = () => {
  renderKnownIds();
  renderTenantSelects();
  renderCurrencySelects();
  renderWalletSelects();
  applyContextToInputs();
};

const bindTenantContext = async (tenantId) => {
  if (!isNonEmptyString(tenantId)) return;
  const previousTenantId = state.knownIds.tenantId;
  setKnownId('tenantId', tenantId);
  if (previousTenantId && previousTenantId !== tenantId) {
    state.knownIds.currencyId = '';
    state.knownIds.walletId = '';
  }
  refreshContextUi();
  await Promise.allSettled([
    loadCurrencies(tenantId, { silent: true }),
    loadWallets(tenantId, { silent: true }),
  ]);
};

const loadTenants = async ({ silent = false } = {}) => {
  const result = await apiRequest({
    service: 'organization',
    path: '/tenants/my',
    method: 'GET',
  });

  if (result.ok) {
    state.tenants = Array.isArray(result.response) ? result.response : [];
    captureKnownIds(state.tenants);
    const tenantExists = state.tenants.some((tenant) => tenant.id === state.knownIds.tenantId);
    if (!tenantExists) {
      state.knownIds.tenantId = state.tenants[0]?.id || state.claims?.tenantId || '';
    }
    renderTenantsTable();
    renderTenantSelects();
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load tenants failed: ${details}`, 'error');
  }

  return result;
};

const loadCurrencies = async (tenantId, { silent = false } = {}) => {
  if (!isNonEmptyString(tenantId)) {
    state.currencies = [];
    renderCurrenciesTable();
    renderCurrencySelects();
    return { ok: true, response: [] };
  }

  const result = await apiRequest({
    service: 'organization',
    path: `/tenants/${encodeURIComponent(tenantId)}/currencies`,
    method: 'GET',
  });

  if (result.ok) {
    state.currencies = Array.isArray(result.response) ? result.response : [];
    captureKnownIds(state.currencies);
    const currencyExists = state.currencies.some((currency) => currency.id === state.knownIds.currencyId);
    if (!currencyExists) {
      state.knownIds.currencyId = state.currencies[0]?.id || '';
    }
    renderCurrenciesTable();
    renderCurrencySelects();
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load currencies failed: ${details}`, 'error');
  }

  return result;
};

const loadWallets = async (tenantId, { silent = false } = {}) => {
  if (!isNonEmptyString(tenantId)) {
    state.wallets = [];
    renderWalletsTable();
    renderWalletSelects();
    return { ok: true, response: [] };
  }

  const result = await apiRequest({
    service: 'organization',
    path: '/wallets/me',
    method: 'GET',
    headers: { 'x-tenant-id': tenantId },
  });

  if (result.ok) {
    state.wallets = Array.isArray(result.response) ? result.response : [];
    captureKnownIds(state.wallets);
    const walletExists = state.wallets.some((wallet) => wallet.id === state.knownIds.walletId);
    if (!walletExists) {
      state.knownIds.walletId = state.wallets[0]?.id || '';
    }
    renderWalletsTable();
    renderWalletSelects();
    writeSnapshot(elements.walletSnapshot, result.response);
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load wallets failed: ${details}`, 'error');
  }

  return result;
};

const loadTransfers = async (page, limit, { silent = false } = {}) => {
  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 20);

  const result = await apiRequest({
    service: 'transfer',
    path: `/transfers?page=${safePage}&limit=${safeLimit}`,
    method: 'GET',
  });

  if (result.ok) {
    state.transfers = Array.isArray(result.response?.data) ? result.response.data : [];
    state.transferMeta = result.response?.meta || null;
    captureKnownIds(result.response);
    renderTransfersTable();
    renderTransferMeta();
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load transfers failed: ${details}`, 'error');
  }

  return result;
};

const loadCurrencyTransactions = async (currencyId, { type = '', page = 1, limit = 20, silent = false } = {}) => {
  if (!isNonEmptyString(currencyId)) {
    state.currencyTransactions = [];
    state.currencyTransactionsMeta = null;
    renderCurrencyTransactionsTable();
    renderTransactionsMeta();
    return { ok: false, response: { message: 'Currency ID is required' } };
  }

  const safePage = parsePage(page, 1);
  const safeLimit = parseLimit(limit, 20);
  const params = new URLSearchParams();
  params.set('page', String(safePage));
  params.set('limit', String(safeLimit));
  if (isNonEmptyString(type)) params.set('type', type);

  const result = await apiRequest({
    service: 'organization',
    path: `/currencies/${encodeURIComponent(currencyId)}/transactions?${params.toString()}`,
    method: 'GET',
  });

  if (result.ok) {
    state.currencyTransactions = Array.isArray(result.response?.data) ? result.response.data : [];
    state.currencyTransactionsMeta = result.response?.meta || null;
    renderCurrencyTransactionsTable();
    renderTransactionsMeta();
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load currency transactions failed: ${details}`, 'error');
  }

  return result;
};

const loadCurrencyStats = async (currencyId, { silent = false } = {}) => {
  if (!isNonEmptyString(currencyId)) {
    state.currencyStats = null;
    renderCurrencyMetrics();
    return { ok: false, response: { message: 'Currency ID is required' } };
  }

  const result = await apiRequest({
    service: 'organization',
    path: `/currencies/${encodeURIComponent(currencyId)}/stats`,
    method: 'GET',
  });

  if (result.ok) {
    state.currencyStats = result.response || null;
    renderCurrencyMetrics();
  } else if (!silent) {
    const details = extractErrorMessage(result.response) || `${result.status} ${result.statusText}`;
    setFlash(`Load currency stats failed: ${details}`, 'error');
  }

  return result;
};

const syncAllData = async () => {
  if (!state.accessToken) {
    setFlash('Login required before syncing protected resources.', 'warn');
    openView('auth');
    return;
  }

  const tenantsResult = await loadTenants({ silent: true });
  if (!tenantsResult.ok) {
    const details = extractErrorMessage(tenantsResult.response) || `${tenantsResult.status} ${tenantsResult.statusText}`;
    setFlash(`Sync failed while loading tenants: ${details}`, 'error');
    return;
  }

  const tenantId = getActiveTenantId();
  await Promise.allSettled([
    loadCurrencies(tenantId, { silent: true }),
    loadWallets(tenantId, { silent: true }),
    loadTransfers(elements.transferPageInput?.value || 1, elements.transferLimitInput?.value || 20, { silent: true }),
  ]);

  const currencyId = getActiveCurrencyId();
  if (currencyId) {
    await Promise.allSettled([
      loadCurrencyStats(currencyId, { silent: true }),
      loadCurrencyTransactions(currencyId, {
        type: elements.transactionTypeFilter?.value || '',
        page: elements.transactionPageInput?.value || 1,
        limit: elements.transactionLimitInput?.value || 20,
        silent: true,
      }),
    ]);
  }

  refreshContextUi();
  setFlash('Data synchronized.');
};

const bindFormSubmit = (form, handler) => {
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handler(form);
  });
};

const getPreferredView = () => (state.accessToken ? 'wallets' : 'auth');

const applyRoleVisibility = () => {
  const isAuthenticated = Boolean(state.accessToken);
  const adminAccess = isAdminRole(state.claims?.role);

  document.querySelectorAll('.requires-admin').forEach((node) => {
    node.hidden = !adminAccess;
  });

  document.querySelectorAll('.requires-guest').forEach((node) => {
    node.hidden = isAuthenticated;
  });

  const activeView = elements.views.find((view) => view.classList.contains('is-active'));
  if (!activeView || activeView.hidden) {
    openView(getPreferredView());
  }
};

const openView = (viewName) => {
  const preferredName = viewName || getPreferredView();
  const targetView =
    elements.views.find((view) => view.dataset.view === preferredName && !view.hidden)
    || elements.views.find((view) => view.dataset.view === getPreferredView() && !view.hidden)
    || elements.views.find((view) => !view.hidden);

  if (!targetView) return;

  const finalViewName = targetView.dataset.view;
  let hasVisibleTab = false;

  elements.viewTabs.forEach((tab) => {
    const isTarget = !tab.hidden && tab.dataset.viewTarget === finalViewName;
    tab.classList.toggle('is-active', isTarget);
    if (isTarget) hasVisibleTab = true;
  });

  if (!hasVisibleTab) {
    const fallbackTab = elements.viewTabs.find((tab) => !tab.hidden);
    if (fallbackTab) {
      fallbackTab.classList.add('is-active');
    }
  }

  elements.views.forEach((view) => {
    view.classList.toggle('is-active', view === targetView);
  });
};

const bindNavigation = () => {
  if (!elements.viewNav) return;

  elements.viewNav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view-target]');
    if (!button) return;
    if (button.hidden) return;
    openView(button.dataset.viewTarget);
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-go-view]');
    if (!trigger) return;
    openView(trigger.dataset.goView);
  });
};

const bindSettings = () => {
  if (elements.authBaseUrl) elements.authBaseUrl.value = state.authBase;
  if (elements.organizationBaseUrl) elements.organizationBaseUrl.value = state.organizationBase;
  if (elements.transferBaseUrl) elements.transferBaseUrl.value = state.transferBase;

  elements.toggleSettingsBtn?.addEventListener('click', () => {
    elements.settingsPanel?.classList.remove('is-collapsed');
  });

  elements.closeSettingsBtn?.addEventListener('click', () => {
    elements.settingsPanel?.classList.add('is-collapsed');
  });

  elements.saveSettingsBtn?.addEventListener('click', () => {
    state.authBase = normalizeBase(elements.authBaseUrl?.value) || defaults.authBase;
    state.organizationBase = normalizeBase(elements.organizationBaseUrl?.value) || defaults.organizationBase;
    state.transferBase = normalizeBase(elements.transferBaseUrl?.value) || defaults.transferBase;

    localStorage.setItem(storageKeys.authBase, state.authBase);
    localStorage.setItem(storageKeys.organizationBase, state.organizationBase);
    localStorage.setItem(storageKeys.transferBase, state.transferBase);

    writeLog('Save API targets', {
      authBase: state.authBase,
      organizationBase: state.organizationBase,
      transferBase: state.transferBase,
    });
    setFlash('API targets saved.');
  });
};

const bindContextSelectors = () => {
  getTenantSelects().forEach((select) => {
    select.addEventListener('change', async () => {
      if (!isNonEmptyString(select.value)) return;
      await bindTenantContext(select.value);
    });
  });

  getCurrencySelects().forEach((select) => {
    select.addEventListener('change', () => {
      if (!isNonEmptyString(select.value)) return;
      setKnownId('currencyId', select.value);
      refreshContextUi();
    });
  });

  getWalletSelects().forEach((select) => {
    select.addEventListener('change', () => {
      if (!isNonEmptyString(select.value)) return;
      setKnownId('walletId', select.value);
      refreshContextUi();
    });
  });
};

const bindTableActions = () => {
  elements.tenantsTableBody?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-select-tenant]');
    if (!button) return;
    const tenantId = button.dataset.selectTenant;
    await bindTenantContext(tenantId);
    setFlash(`Tenant context set: ${tenantId}`);
  });

  elements.currenciesTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-select-currency]');
    if (!button) return;
    const currencyId = button.dataset.selectCurrency;
    if (!currencyId) return;
    setKnownId('currencyId', currencyId);
    refreshContextUi();
    setFlash(`Currency context set: ${currencyId}`);
  });

  elements.walletsTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-select-wallet]');
    if (!button) return;
    const walletId = button.dataset.selectWallet;
    if (!walletId) return;
    setKnownId('walletId', walletId);
    refreshContextUi();
    setFlash(`Wallet context set: ${walletId}`);
  });

  elements.transfersTableBody?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-bind-transfer-id]');
    if (!button) return;
    if (button.dataset.bindTransferId) setKnownId('transferId', button.dataset.bindTransferId);
    if (button.dataset.bindTransferRef) setKnownId('transferReference', button.dataset.bindTransferRef);
    refreshContextUi();
    setFlash('Transfer identifiers bound to context.');
  });
};

const bindActions = () => {
  elements.syncAllBtn?.addEventListener('click', async () => {
    await runAction('Sync data', async () => ({ ok: true, response: {} }), {
      onSuccess: async () => {
        await syncAllData();
      },
    });
  });

  elements.clearSessionBtn?.addEventListener('click', () => {
    clearSession();
    writeLog('Clear session', { ok: true });
    setFlash('Session cleared.');
  });

  bindFormSubmit(elements.createTenantForm, async (form) => {
    await runAction('Create tenant + admin', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'auth',
        path: '/tenants',
        method: 'POST',
        body: values,
        withAuth: false,
      });
    }, {
      onSuccess: async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken);
        }
        if (result.response?.tenant) {
          writeSnapshot(elements.tenantSnapshot, result.response.tenant);
        }
        await syncAllData();
      },
    });
  });

  bindFormSubmit(elements.registerUserForm, async (form) => {
    await runAction('Register user', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'auth',
        path: '/auth/register',
        method: 'POST',
        body: values,
        withAuth: false,
      });
    });
  });

  bindFormSubmit(elements.verifyEmailForm, async (form) => {
    await runAction('Verify email OTP', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'auth',
        path: '/auth/verify-email',
        method: 'POST',
        body: values,
        withAuth: false,
      });
    });
  });

  bindFormSubmit(elements.resendOtpForm, async (form) => {
    await runAction('Resend OTP', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'auth',
        path: '/auth/resend-otp',
        method: 'POST',
        body: values,
        withAuth: false,
      });
    });
  });

  bindFormSubmit(elements.loginForm, async (form) => {
    await runAction('Login', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'auth',
        path: '/auth/login',
        method: 'POST',
        body: values,
        withAuth: false,
      });
    }, {
      onSuccess: async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken || state.refreshToken);
        }
        await syncAllData();
      },
    });
  });

  bindFormSubmit(elements.refreshTokenForm, async (form) => {
    await runAction('Refresh token', async () => {
      const values = removeEmptyValues(collectForm(form));
      const refreshToken = values.refreshToken || state.refreshToken;
      if (!isNonEmptyString(refreshToken)) {
        throw new Error('Refresh token is required');
      }

      return apiRequest({
        service: 'auth',
        path: '/auth/refresh',
        method: 'POST',
        body: { refreshToken },
        withAuth: false,
      });
    }, {
      onSuccess: async (result) => {
        const tokens = extractTokens(result.response);
        if (tokens) {
          setTokens(tokens.accessToken, tokens.refreshToken || state.refreshToken);
        }
      },
    });
  });

  elements.logoutBtn?.addEventListener('click', async () => {
    await runAction('Logout', async () =>
      apiRequest({
        service: 'auth',
        path: '/auth/logout',
        method: 'POST',
      }), {
      onSuccess: async (result) => {
        if (result.ok) clearSession();
      },
    });
  });

  elements.loadTenantsBtn?.addEventListener('click', async () => {
    await runAction('Load my tenants', async () => loadTenants(), {
      onSuccess: async () => {
        const tenantId = getActiveTenantId();
        if (tenantId) {
          await Promise.allSettled([
            loadCurrencies(tenantId, { silent: true }),
            loadWallets(tenantId, { silent: true }),
          ]);
        }
      },
    });
  });

  bindFormSubmit(elements.getTenantForm, async (form) => {
    await runAction('Load tenant details', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(values.tenantId)}`,
        method: 'GET',
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.tenantSnapshot, result.response);
      },
    });
  });

  bindFormSubmit(elements.updateTenantForm, async (form) => {
    await runAction('Update tenant', async () => {
      const values = removeEmptyValues(collectForm(form));
      const tenantId = values.tenantId;
      delete values.tenantId;

      return apiRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(tenantId)}`,
        method: 'PATCH',
        body: values,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.tenantSnapshot, result.response);
        await loadTenants({ silent: true });
      },
    });
  });

  bindFormSubmit(elements.createCurrencyForm, async (form) => {
    await runAction('Create currency', async () => {
      const rawValues = collectForm(form);
      const values = removeEmptyValues(rawValues);
      const tenantId = values.tenantId;
      const legacyRoute = Boolean(form.querySelector('input[name="legacyRoute"]')?.checked);

      const body = {
        name: values.name,
        symbol: values.symbol,
        initialSupply: parsePositiveNumber(values.initialSupply, 'initialSupply'),
      };

      if (isNonEmptyString(values.color)) body.color = values.color;

      const earnRules = parseJsonObjectOptional(values.earnRules, 'earnRules');
      if (earnRules !== undefined) body.earnRules = earnRules;

      const expiryDays = parseExpiryDaysCreate(values.expiryDays);
      if (expiryDays !== undefined) body.expiryDays = expiryDays;

      if (!legacyRoute && tenantId && state.claims?.tenantId && tenantId !== state.claims.tenantId) {
        setFlash('Selected tenant differs from current token tenant. /currencies uses token tenant.', 'warn');
      }

      const path = legacyRoute
        ? `/tenants/${encodeURIComponent(tenantId)}/currencies`
        : '/currencies';

      return apiRequest({
        service: 'organization',
        path,
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.currencySnapshot, result.response);
        const tenantId = getActiveTenantId();
        await loadCurrencies(tenantId, { silent: true });
        await loadWallets(tenantId, { silent: true });
      },
    });
  });

  elements.loadCurrenciesBtn?.addEventListener('click', async () => {
    await runAction('Load currencies', async () => {
      const tenantId =
        elements.currencyActionsForm?.querySelector('select[name="tenantId"]')?.value
        || getActiveTenantId();
      return loadCurrencies(tenantId);
    });
  });

  elements.loadCurrencyLegacyBtn?.addEventListener('click', async () => {
    await runAction('Load currency (legacy detail)', async () => {
      const tenantId = elements.currencyActionsForm?.querySelector('select[name="tenantId"]')?.value || getActiveTenantId();
      const currencyId = elements.currencyActionsForm?.querySelector('select[name="currencyId"]')?.value || getActiveCurrencyId();
      if (!isNonEmptyString(tenantId) || !isNonEmptyString(currencyId)) {
        throw new Error('Tenant and currency are required');
      }

      return apiRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(tenantId)}/currencies/${encodeURIComponent(currencyId)}`,
        method: 'GET',
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.currencySnapshot, result.response);
      },
    });
  });

  elements.loadCurrencyViewBtn?.addEventListener('click', async () => {
    await runAction('Load currency view', async () => {
      const currencyId = elements.currencyActionsForm?.querySelector('select[name="currencyId"]')?.value || getActiveCurrencyId();
      if (!isNonEmptyString(currencyId)) {
        throw new Error('Currency is required');
      }

      return apiRequest({
        service: 'organization',
        path: `/currencies/${encodeURIComponent(currencyId)}`,
        method: 'GET',
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.currencySnapshot, result.response);
      },
    });
  });

  bindFormSubmit(elements.updateCurrencyForm, async (form) => {
    await runAction('Update currency', async () => {
      const values = removeEmptyValues(collectForm(form));
      const currencyId = values.currencyId;
      delete values.currencyId;

      const body = {};
      if (isNonEmptyString(values.name)) body.name = values.name;
      if (isNonEmptyString(values.color)) body.color = values.color;
      if (isNonEmptyString(values.symbol)) body.symbol = values.symbol;

      const earnRules = parseJsonObjectOptional(values.earnRules, 'earnRules');
      if (earnRules !== undefined) body.earnRules = earnRules;

      const expiryDays = parseExpiryDaysUpdate(values.expiryDays);
      if (expiryDays !== undefined) body.expiryDays = expiryDays;

      if (!Object.keys(body).length) {
        throw new Error('Provide at least one updatable field');
      }

      return apiRequest({
        service: 'organization',
        path: `/currencies/${encodeURIComponent(currencyId)}`,
        method: 'PATCH',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.currencySnapshot, result.response);
        const tenantId = getActiveTenantId();
        await loadCurrencies(tenantId, { silent: true });
      },
    });
  });

  bindFormSubmit(elements.addMemberWalletForm, async (form) => {
    await runAction('Add member wallet', async () => {
      const values = removeEmptyValues(collectForm(form));
      const body = { userId: values.userId };
      return apiRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(values.tenantId)}/currencies/${encodeURIComponent(values.currencyId)}/members`,
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.walletSnapshot, result.response);
        const tenantId = getActiveTenantId();
        await loadWallets(tenantId, { silent: true });
      },
    });
  });

  bindFormSubmit(elements.mintCurrencyForm, async (form) => {
    await runAction('Mint currency', async () => {
      const values = removeEmptyValues(collectForm(form));
      const body = {
        recipientId: values.recipientId,
        amount: parsePositiveNumber(values.amount, 'amount'),
      };
      if (isNonEmptyString(values.reason)) body.reason = values.reason;

      return apiRequest({
        service: 'organization',
        path: `/currencies/${encodeURIComponent(values.currencyId)}/mint`,
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.walletSnapshot, result.response);
        const tenantId = getActiveTenantId();
        const currencyId = getActiveCurrencyId();
        await Promise.allSettled([
          loadWallets(tenantId, { silent: true }),
          loadCurrencies(tenantId, { silent: true }),
          loadCurrencyStats(currencyId, { silent: true }),
          loadCurrencyTransactions(currencyId, {
            type: elements.transactionTypeFilter?.value || '',
            page: elements.transactionPageInput?.value || 1,
            limit: elements.transactionLimitInput?.value || 20,
            silent: true,
          }),
        ]);
      },
    });
  });

  bindFormSubmit(elements.burnCurrencyForm, async (form) => {
    await runAction('Burn currency', async () => {
      const values = removeEmptyValues(collectForm(form));
      const body = {
        amount: parsePositiveNumber(values.amount, 'amount'),
      };
      if (isNonEmptyString(values.reason)) body.reason = values.reason;

      return apiRequest({
        service: 'organization',
        path: `/currencies/${encodeURIComponent(values.currencyId)}/burn`,
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.walletSnapshot, result.response);
        const tenantId = getActiveTenantId();
        const currencyId = getActiveCurrencyId();
        await Promise.allSettled([
          loadWallets(tenantId, { silent: true }),
          loadCurrencies(tenantId, { silent: true }),
          loadCurrencyStats(currencyId, { silent: true }),
          loadCurrencyTransactions(currencyId, {
            type: elements.transactionTypeFilter?.value || '',
            page: elements.transactionPageInput?.value || 1,
            limit: elements.transactionLimitInput?.value || 20,
            silent: true,
          }),
        ]);
      },
    });
  });

  bindFormSubmit(elements.legacyMintForm, async (form) => {
    await runAction('Legacy mint', async () => {
      const values = removeEmptyValues(collectForm(form));
      const body = {
        membershipId: values.walletId,
        amount: parsePositiveNumber(values.amount, 'amount'),
      };
      if (isNonEmptyString(values.reason)) body.reason = values.reason;

      return apiRequest({
        service: 'organization',
        path: `/tenants/${encodeURIComponent(values.tenantId)}/mint`,
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.walletSnapshot, result.response);
        const tenantId = getActiveTenantId();
        await Promise.allSettled([
          loadWallets(tenantId, { silent: true }),
          loadCurrencies(tenantId, { silent: true }),
        ]);
      },
    });
  });

  elements.loadCurrencyStatsBtn?.addEventListener('click', async () => {
    await runAction('Load currency stats panel', async () => {
      const currencyId = getActiveCurrencyId();
      return loadCurrencyStats(currencyId);
    });
  });

  elements.loadCurrencyTransactionsBtn?.addEventListener('click', async () => {
    await runAction('Load currency transactions', async () => {
      const currencyId = getActiveCurrencyId();
      return loadCurrencyTransactions(currencyId, {
        type: elements.transactionTypeFilter?.value || '',
        page: elements.transactionPageInput?.value || 1,
        limit: elements.transactionLimitInput?.value || 20,
      });
    });
  });

  elements.loadWalletsBtn?.addEventListener('click', async () => {
    await runAction('Load wallets', async () => {
      const tenantId = elements.walletTenantSelect?.value || getActiveTenantId();
      return loadWallets(tenantId);
    });
  });

  bindFormSubmit(elements.createTransferForm, async (form) => {
    await runAction('Create transfer', async () => {
      const values = removeEmptyValues(collectForm(form));
      const body = {
        receiverPhone: values.receiverPhone,
        receiverName: values.receiverName,
        amount: parsePositiveNumber(values.amount, 'amount'),
        currency: values.currency,
        type: values.type,
      };
      if (isNonEmptyString(values.note)) body.note = values.note;

      return apiRequest({
        service: 'transfer',
        path: '/transfers',
        method: 'POST',
        body,
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.transferSnapshot, result.response);
        await loadTransfers(elements.transferPageInput?.value || 1, elements.transferLimitInput?.value || 20, {
          silent: true,
        });
      },
    });
  });

  bindFormSubmit(elements.getTransferForm, async (form) => {
    await runAction('Get transfer by reference', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'transfer',
        path: `/transfers/${encodeURIComponent(values.reference)}`,
        method: 'GET',
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.transferSnapshot, result.response);
      },
    });
  });

  bindFormSubmit(elements.cancelTransferForm, async (form) => {
    await runAction('Cancel transfer', async () => {
      const values = removeEmptyValues(collectForm(form));
      return apiRequest({
        service: 'transfer',
        path: `/transfers/${encodeURIComponent(values.id)}/cancel`,
        method: 'PATCH',
      });
    }, {
      onSuccess: async (result) => {
        writeSnapshot(elements.transferSnapshot, result.response);
        await loadTransfers(elements.transferPageInput?.value || 1, elements.transferLimitInput?.value || 20, {
          silent: true,
        });
      },
    });
  });

  elements.loadTransfersBtn?.addEventListener('click', async () => {
    await runAction('Load transfer history', async () =>
      loadTransfers(
        elements.transferPageInput?.value || 1,
        elements.transferLimitInput?.value || 20,
      ),
    );
  });
};

const initialize = async () => {
  bindNavigation();
  bindSettings();
  bindContextSelectors();
  bindTableActions();
  bindActions();

  renderTenantsTable();
  renderCurrenciesTable();
  renderWalletsTable();
  renderTransfersTable();
  renderCurrencyTransactionsTable();
  renderTransferMeta();
  renderTransactionsMeta();
  renderCurrencyMetrics();
  refreshContextUi();
  updateSessionUi();
  openView(getPreferredView());
  writeLog('UI initialized', {
    authBase: state.authBase,
    organizationBase: state.organizationBase,
    transferBase: state.transferBase,
  });

  if (state.accessToken) {
    await syncAllData();
  } else {
    setFlash('Ready. Start from onboarding or login.', 'info');
  }
};

initialize();
