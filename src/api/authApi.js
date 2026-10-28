import api from './axios.js';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload).then((r) => r.data),
  signup: (payload) => api.post('/auth/signup', payload).then((r) => r.data),
  verifyEmail: (payload) => api.post('/auth/verify-email', payload).then((r) => r.data),
  resendVerification: (payload) => api.post('/auth/resend-verification', payload).then((r) => r.data),
  changePassword: (payload) => api.post('/auth/change-password', payload).then((r) => r.data),
  refresh: () => api.post('/auth/refresh').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload).then((r) => r.data),
  resetPassword: (payload) => api.post('/auth/reset-password', payload).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  updateProfile: (payload) => api.patch('/auth/profile', payload).then((r) => r.data),
};
