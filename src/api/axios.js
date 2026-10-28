import axios from "axios";
import { useAuthStore } from "../store/authStore.js";

const configuredBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/';
const baseURL = configuredBaseURL.endsWith('/') ? configuredBaseURL : `${configuredBaseURL}/`;

export const api = axios.create({
  baseURL,
  withCredentials: true, // sends the httpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/") &&
      !useAuthStore.getState().support // support sessions can't refresh — they just end
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = api.post("/auth/refresh").finally(() => {
            refreshPromise = null;
          });
        }
        const { data } = await refreshPromise;
        useAuthStore.getState().setAccessToken(data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearSession();
        return Promise.reject(refreshError);
      }
    }

    // SaaS: trial over / payment due (402) or plan limit hit (403 PLAN_LIMIT)
    // → tell the layout so it can show an "Upgrade" prompt anywhere in the app.
    const code = error.response?.data?.details?.code;
    if (status === 402 || code === 'PLAN_LIMIT') {
      window.dispatchEvent(new CustomEvent('propai:billing', {
        detail: { code: code || 'SUBSCRIPTION_INACTIVE', message: error.response?.data?.message },
      }));
    }

    return Promise.reject(error);
  },
);

export default api;
