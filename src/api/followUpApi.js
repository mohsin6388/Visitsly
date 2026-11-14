import api from './axios.js';

export const followUpApi = {
  list: (params) => api.get('/followups', { params }).then((r) => r.data),
  update: (id, payload) => api.patch(`/followups/${id}`, payload).then((r) => r.data),
  send: (id, text) => api.post(`/followups/${id}/send`, text ? { text } : {}).then((r) => r.data),
  remove: (id) => api.delete(`/followups/${id}`).then((r) => r.data),
  createForLead: (leadId, payload) => api.post(`/followups/lead/${leadId}`, payload).then((r) => r.data),
};
