// export const BACKEND_HOST = 'https://dev.pay.fidelity-market.com';
export const BACKEND_HOST = 'http://localhost:8060';
export const API_ROOT = `${BACKEND_HOST}/api`;
export const API_V1_ROOT = `${API_ROOT}/v1`;

export const AUTH_API_BASE = `${API_V1_ROOT}/auth`;
export const ADMIN_USERS_API = `${API_V1_ROOT}/admin/users`;
export const DEVELOPER_KEYS_API = `${API_V1_ROOT}/developer/keys`;
export const DEVELOPER_WEBHOOKS_API = `${API_V1_ROOT}/developer/webhooks`;
export const ADMIN_DEVELOPERS_API = `${API_V1_ROOT}/admin/developers`;
export const DEVELOPER_PAYMENT_ROUTES_API = `${API_V1_ROOT}/developer/payment-routes`;
export const ADMIN_PAYMENT_ROUTES_API = `${API_V1_ROOT}/admin/payment-routes`;
export const PAYMENT_API = API_ROOT;
export const MONITORING_API = `${API_ROOT}/monitoring`;

export const ADMIN_PAYMENT_PROVIDERS_API = `${API_V1_ROOT}/admin/payment-providers`;
export const DEVELOPER_PAYMENT_PROVIDERS_API = `${API_V1_ROOT}/developer/payment-providers`;
export const DEVELOPER_PROVIDER_ACCOUNTS_API = `${API_V1_ROOT}/developer/provider-accounts`;
export const ADMIN_PAYMENT_PROVIDER_ROUTES_API = `${API_V1_ROOT}/admin/payment-provider-routes`;
export const ADMIN_FALLBACK_SETTINGS_API = `${API_V1_ROOT}/admin/routing/fallback-settings`;
export const DEVELOPER_ROUTING_PREVIEW_API = `${API_V1_ROOT}/developer/routing/preview`;
