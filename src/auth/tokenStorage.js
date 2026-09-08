const TOKEN_KEY = 'auth_refresh_token';
const ACCESS_KEY = 'auth_access_token';

export function storeTokens(accessToken, refreshToken) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(TOKEN_KEY, refreshToken);
}

export function getRefreshToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_KEY);
}
