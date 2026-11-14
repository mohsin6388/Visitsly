import api from './axios.js';

export const meetingApi = {
  list: (params) => api.get('/meetings', { params }).then((r) => r.data),
  create: (payload) => api.post('/meetings', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/meetings/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/meetings/${id}`).then((r) => r.data),
  callConfirmation: (id) => api.post(`/meetings/${id}/call-confirmation`).then((r) => r.data),
  sendConfirmation: (id) => api.post(`/meetings/${id}/send-confirmation`).then((r) => r.data),
  markConfirmation: (id, status) => api.post(`/meetings/${id}/mark-confirmation`, { status }).then((r) => r.data),
  confirmationStats: (days = 30) => api.get('/meetings/confirmation-stats', { params: { days } }).then((r) => r.data),
};