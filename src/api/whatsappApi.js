import api from './axios.js';

export const whatsappApi = {
  status: () => api.get('/whatsapp/status').then((r) => r.data),
  diagnostics: () => api.get('/whatsapp/diagnostics').then((r) => r.data),
  repairSubscription: () => api.post('/whatsapp/repair-subscription').then((r) => r.data),
  templates: () => api.get('/whatsapp/templates').then((r) => r.data),
  allTemplates: () => api.get('/whatsapp/templates/all').then((r) => r.data),
  createTemplate: (payload) => api.post('/whatsapp/templates', payload).then((r) => r.data),
  deleteTemplate: (name) => api.delete(`/whatsapp/templates/${encodeURIComponent(name)}`).then((r) => r.data),
  sendTest: (phone, text) => api.post('/whatsapp/send-test', { phone, text }).then((r) => r.data),
  sendTestTemplate: (phone, options = {}) => api.post('/whatsapp/send-test-template', { phone, ...options }).then((r) => r.data),
  disconnect: () => api.post('/whatsapp/disconnect').then((r) => r.data),
  reconnect: () => api.post('/whatsapp/reconnect').then((r) => r.data),
};
