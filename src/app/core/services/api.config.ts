// export const BACKEND_HOST = 'https://dev.pay.fidelity-market.com';
export const BACKEND_HOST = 'http://localhost:8060';
export const API_ROOT = `${BACKEND_HOST}/api`;
export const API_V1_ROOT = `${API_ROOT}/v1`;

export const AUTH_API_BASE = `${API_V1_ROOT}/auth`;
export const ADMIN_USERS_API = `${API_V1_ROOT}/admin/users`;
export const DEVELOPER_KEYS_API = `${API_V1_ROOT}/developer/keys`;
export const ADMIN_DEVELOPERS_API = `${API_V1_ROOT}/admin/developers`;
export const PAYMENT_API = API_ROOT;
export const MONITORING_API = `${API_ROOT}/monitoring`;
export const ADMIN_AGREGATEURS_API = `${API_V1_ROOT}/admin/agregateurs`;