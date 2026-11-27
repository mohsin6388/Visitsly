import api from './axios.js';

export const emailApi = {
  // Sender + wallet in one call (Email setup page, campaign launcher, settings)
  status: () => api.get('/email/status').then((r) => r.data),

  // Company sender: official email → 6-digit code → domain authentication
  startSender: (payload) => api.post('/email/sender', payload).then((r) => r.data),
  verifySender: (otp) => api.post('/email/sender/verify', { otp }).then((r) => r.data),
  resendCode: () => api.post('/email/sender/resend').then((r) => r.data),
  checkDns: () => api.post('/email/sender/check-dns').then((r) => r.data),
  removeSender: () => api.delete('/email/sender').then((r) => r.data),

  // Per-email wallet
  wallet: () => api.get('/email/wallet').then((r) => r.data),
  estimate: (count) => api.get('/email/estimate', { params: { count } }).then((r) => r.data),

  // Templates
  templates: () => api.get('/email/templates').then((r) => r.data),
  createTemplate: (payload) => api.post('/email/templates', payload).then((r) => r.data),
  updateTemplate: (id, payload) => api.put(`/email/templates/${id}`, payload).then((r) => r.data),
  deleteTemplate: (id) => api.delete(`/email/templates/${id}`).then((r) => r.data),

  // Delivery details (sent / failed / per day)
  details: (params) => api.get('/email/details', { params }).then((r) => r.data),
};
