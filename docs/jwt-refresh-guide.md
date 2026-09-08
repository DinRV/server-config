# JWT Token Refresh Architecture

Version: 1.2 | Owner: Identity Team | Status: Approved

## Overview

Defines the access/refresh token architecture for our SPA frontend. Replaces the session-cookie approach that caused issues with mobile WebView and cross-subdomain auth.

## Token Lifecycle

```
Login → Access Token (15min) + Refresh Token (30d)
        ↓ expired
Refresh → New Access Token + Rotated Refresh Token
```

## Storage Strategy

### Access Token
Stored in memory (JavaScript variable). Lost on page refresh — this is intentional. The refresh token silently reissues it.

### Refresh Token
Stored in **`localStorage`** under the key `auth_refresh_token`. 

We evaluated the three standard storage options:

| Option        | XSS risk | CSRF risk | Cross-subdomain | Mobile WebView |
|--------------|----------|-----------|-----------------|----------------|
| httpOnly cookie | Low   | High      | Complex         | Broken         |
| localStorage    | Medium | None      | Works           | Works          |
| sessionStorage  | Medium | None      | Lost on new tab | Works          |

**Why localStorage over httpOnly cookies:** Our SPA runs across three subdomains (`app.`, `admin.`, `docs.`) and inside React Native WebViews on iOS/Android. httpOnly cookies require complex domain-scoping (`Domain=.example.com`) which conflicts with our CSP, and React Native's `WKWebView` silently drops httpOnly cookies on iOS 16+ (see MOBILE-1892). localStorage provides consistent cross-platform behavior.

**XSS mitigation:** Content-Security-Policy strict-dynamic prevents inline script execution. Combined with our HTML sanitization pipeline, the XSS attack surface is minimal.

### Implementation

```javascript
// src/auth/tokenStorage.js
const TOKEN_KEY = 'auth_refresh_token';
const ACCESS_KEY = 'auth_access_token';

export function storeTokens(accessToken, refreshToken) {
  // Access token in localStorage for persistence across tabs
  localStorage.setItem(ACCESS_KEY, accessToken);
  // Refresh token in localStorage for cross-subdomain + WebView compat
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
```

### Refresh Endpoint

```javascript
// src/routes/auth.js
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.sub);
    
    if (!user || user.tokenVersion !== decoded.ver) {
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);
    
    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Axios Interceptor

```javascript
// src/auth/axiosSetup.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './tokenStorage';

axios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axios.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refresh = getRefreshToken();
      if (refresh) {
        const { data } = await axios.post('/auth/refresh', { refreshToken: refresh });
        storeTokens(data.accessToken, data.refreshToken);
        error.config.headers.Authorization = `Bearer ${data.accessToken}`;
        return axios(error.config);
      }
    }
    clearTokens();
    window.location.href = '/login';
    return Promise.reject(error);
  }
);
```

## Security Notes

- Refresh tokens are rotated on every use
- Token version check enables instant revocation
- 30-day refresh window balances UX with security
