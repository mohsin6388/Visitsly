import api from './axios.js';

export const emailApi = {
  // The client's own official email
  account: () => api.get('/email/account').then((r) => r.data),
  saveAccount: (payload) => api.put('/email/account', payload).then((r) => r.data),
  testAccount: (to) => api.post('/email/account/test', { to }).then((r) => r.data),
  removeAccount: () => api.delete('/email/account').then((r) => r.data),

  // Templates
  templates: () => api.get('/email/templates').then((r) => r.data),
  createTemplate: (payload) => api.post('/email/templates', payload).then((r) => r.data),
  updateTemplate: (id, payload) => api.put(`/email/templates/${id}`, payload).then((r) => r.data),
  deleteTemplate: (id) => api.delete(`/email/templates/${id}`).then((r) => r.data),

  // Delivery details (sent / failed / per day)
  details: (params) => api.get('/email/details', { params }).then((r) => r.data),
};
