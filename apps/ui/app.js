const storageKeys = {
  authBase: 'omt.ui.authBase',
  transferBase: 'omt.ui.transferBase',
  accessToken: 'omt.ui.accessToken',
  refreshToken: 'omt.ui.refreshToken',
};

const defaults = {
  authBase: 'http://localhost:3001',
  transferBase: 'http://localhost:3002/api/v1',
};

const state = {
  authBase: localStorage.getItem(storageKeys.authBase) || defaults.authBase,
  transferBase: localStorage.getItem(storageKeys.transferBase) || defaults.transferBase,
  accessToken: localStorage.getItem(storageKeys.accessToken) || '',
  refreshToken: localStorage.getItem(storageKeys.refreshToken) || '',
};

const elements = {
  authBaseUrl: document.getElementById('authBaseUrl'),
  transferBaseUrl: document.getElementById('transferBaseUrl'),
  saveSettings: document.getElementById('saveSettings'),
  clearSession: document.getElementById('clearSession'),
  tokenStatus: document.getElementById('tokenStatus'),
  responseBox: document.getElementById('responseBox'),
  refreshForm: document.getElementById('refreshForm'),
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

const maskToken = (token) => {
  if (!token) return 'none';
  if (token.length <= 18) return token;
  return `${token.slice(0, 10)}...${token.slice(-6)}`;
};

const updateTokenStatus = () => {
  elements.tokenStatus.textContent = `Session: ${maskToken(state.accessToken)}`;
};

const writeLog = (title, payload) => {
  const timestamp = new Date().toISOString();
  elements.responseBox.textContent =
    `[${timestamp}] ${title}\n\n${JSON.stringify(payload, null, 2)}`;
};

const setTokens = (accessToken, refreshToken) => {
  if (typeof accessToken === 'string' && accessToken) {
    state.accessToken = accessToken;
    localStorage.setItem(storageKeys.accessToken, accessToken);
  }

  if (typeof refreshToken === 'string' && refreshToken) {
    state.refreshToken = refreshToken;
    localStorage.setItem(storageKeys.refreshToken, refreshToken);
    const refreshInput = elements.refreshForm.querySelector('textarea[name="refreshToken"]');
    refreshInput.value = refreshToken;
  }

  updateTokenStatus();
};

const clearTokens = () => {
  state.accessToken = '';
  state.refreshToken = '';
  localStorage.removeItem(storageKeys.accessToken);
  localStorage.removeItem(storageKeys.refreshToken);
  const refreshInput = elements.refreshForm.querySelector('textarea[name="refreshToken"]');
  refreshInput.value = '';
  updateTokenStatus();
};

const makeRequest = async ({ service, path, method, body, withAuth = false }) => {
  const base = service === 'auth' ? state.authBase : state.transferBase;
  const url = `${normalizeBase(base)}${path}`;
  const headers = { 'Content-Type': 'application/json' };

  if (withAuth && state.accessToken) {
    headers.Authorization = `Bearer ${state.accessToken}`;
  }

  const requestInit = { method, headers };
  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(url, requestInit);
  const rawText = await response.text();
  const parsed = tryParseJson(rawText);
  const responseData = parsed ?? rawText;

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    request: {
      method,
      body,
      withAuth,
    },
    response: responseData,
  };
};

const collectForm = (form) => Object.fromEntries(new FormData(form).entries());

const removeEmptyValues = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => {
      if (typeof value === 'string') return value.trim() !== '';
      return value !== undefined && value !== null;
    }),
  );

const run = async (title, requestFactory) => {
  try {
    const result = await requestFactory();
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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handler(form);
  });
};

const initialize = () => {
  elements.authBaseUrl.value = state.authBase;
  elements.transferBaseUrl.value = state.transferBase;
  if (state.refreshToken) {
    elements.refreshForm.querySelector('textarea[name="refreshToken"]').value = state.refreshToken;
  }
  updateTokenStatus();

  elements.saveSettings.addEventListener('click', () => {
    state.authBase = normalizeBase(elements.authBaseUrl.value) || defaults.authBase;
    state.transferBase = normalizeBase(elements.transferBaseUrl.value) || defaults.transferBase;
    localStorage.setItem(storageKeys.authBase, state.authBase);
    localStorage.setItem(storageKeys.transferBase, state.transferBase);
    writeLog('Saved targets', {
      authBase: state.authBase,
      transferBase: state.transferBase,
    });
  });

  elements.clearSession.addEventListener('click', () => {
    clearTokens();
    writeLog('Session cleared', { accessToken: null, refreshToken: null });
  });

  bindSubmit('registerForm', (form) =>
    run('Register', async () => {
      const values = removeEmptyValues(collectForm(form));
      return makeRequest({
        service: 'auth',
        path: '/auth/register',
        method: 'POST',
        body: values,
      });
    }),
  );

  bindSubmit('verifyEmailForm', (form) =>
    run('Verify email', async () =>
      makeRequest({
        service: 'auth',
        path: '/auth/verify-email',
        method: 'POST',
        body: removeEmptyValues(collectForm(form)),
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
      }),
    ),
  );

  bindSubmit('loginForm', (form) =>
    run('Login', async () => {
      const response = await makeRequest({
        service: 'auth',
        path: '/auth/login',
        method: 'POST',
        body: removeEmptyValues(collectForm(form)),
      });
      if (response.ok && response.response && typeof response.response === 'object') {
        setTokens(response.response.accessToken, response.response.refreshToken);
      }
      return response;
    }),
  );

  bindSubmit('refreshForm', (form) =>
    run('Refresh token', async () => {
      const values = removeEmptyValues(collectForm(form));
      const refreshToken = values.refreshToken || state.refreshToken;
      const response = await makeRequest({
        service: 'auth',
        path: '/auth/refresh',
        method: 'POST',
        body: { refreshToken },
      });
      if (response.ok && response.response && typeof response.response === 'object') {
        setTokens(response.response.accessToken, response.response.refreshToken);
      }
      return response;
    }),
  );

  bindSubmit('logoutForm', () =>
    run('Logout', async () => {
      const response = await makeRequest({
        service: 'auth',
        path: '/auth/logout',
        method: 'POST',
        withAuth: true,
      });
      if (response.ok) clearTokens();
      return response;
    }),
  );

  bindSubmit('createTransferForm', (form) =>
    run('Create transfer', async () => {
      const values = removeEmptyValues(collectForm(form));
      values.amount = Number(values.amount);
      return makeRequest({
        service: 'transfer',
        path: '/transfers',
        method: 'POST',
        body: values,
        withAuth: true,
      });
    }),
  );

  bindSubmit('listTransfersForm', (form) =>
    run('List transfers', async () => {
      const values = removeEmptyValues(collectForm(form));
      const page = Number(values.page || 1);
      const limit = Number(values.limit || 20);
      return makeRequest({
        service: 'transfer',
        path: `/transfers?page=${page}&limit=${limit}`,
        method: 'GET',
        withAuth: true,
      });
    }),
  );

  bindSubmit('getTransferForm', (form) =>
    run('Get transfer by reference', async () => {
      const values = removeEmptyValues(collectForm(form));
      return makeRequest({
        service: 'transfer',
        path: `/transfers/${encodeURIComponent(values.reference)}`,
        method: 'GET',
        withAuth: true,
      });
    }),
  );

  bindSubmit('cancelTransferForm', (form) =>
    run('Cancel transfer', async () => {
      const values = removeEmptyValues(collectForm(form));
      return makeRequest({
        service: 'transfer',
        path: `/transfers/${encodeURIComponent(values.id)}/cancel`,
        method: 'PATCH',
        withAuth: true,
      });
    }),
  );
};

initialize();
