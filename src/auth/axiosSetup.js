import axios from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  storeTokens,
  clearTokens
} from './tokenStorage';

export function setupAxiosInterceptors() {
  axios.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        const refreshToken = getRefreshToken();

        if (refreshToken) {
          try {
            const { data } = await axios.post('/auth/refresh', {
              refreshToken
            });

            storeTokens(data.accessToken, data.refreshToken);
            error.config.headers.Authorization = `Bearer ${data.accessToken}`;
            return axios(error.config);
          } catch (refreshError) {
            clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
      }

      if (error.response?.status === 401) {
        clearTokens();
        window.location.href = '/login';
      }

      return Promise.reject(error);
    }
  );
}
