/**
 * Typed Axios client for the GarmentFlow API.
 *
 * - Base URL read from VITE_API_URL env var (falls back to http://127.0.0.1:8000)
 * - Request interceptor: attaches JWT from localStorage to every request
 * - Response interceptor: on 401, clears token and redirects to /login
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ---- Request interceptor: attach JWT ----------------------------------------
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gf_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: handle 401 globally ------------------------------
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't intercept 401 on the login endpoint itself — let the login form
    // catch it and show the "Invalid credentials" error banner.
    const isLoginRequest = error.config?.url === '/auth/login';
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('gf_token');
      localStorage.removeItem('gf_user');
      window.location.replace('/login');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
