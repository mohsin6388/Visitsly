import api from './axios.js';

export const leadApi = {
  list: (params) => api.get('/leads', { params }).then((r) => r.data),
  get: (id) => api.get(`/leads/${id}`).then((r) => r.data),
  create: (payload) => api.post('/leads', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/leads/${id}`, payload).then((r) => r.data),
  remove: (id) => api.delete(`/leads/${id}`).then((r) => r.data),
  bulkDelete: (ids) => api.post('/leads/bulk-delete', { ids }).then((r) => r.data),
  updateTags: (id, payload) => api.post(`/leads/${id}/tags`, payload).then((r) => r.data),
  importPreview: (file, channel = 'both', onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/leads/import/preview', form, {
        params: { channel },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
      })
      .then((r) => r.data);
  },
  importParseText: (text) => api.post('/leads/import/parse-text', { text }).then((r) => r.data),
  importConfirm: (rows) => api.post('/leads/import/confirm', { rows }, { timeout: 120000 }).then((r) => r.data),
  startConversations: (leadIds) => api.post('/leads/start-conversations', { leadIds }).then((r) => r.data),
  importFiles: () => api.get('/leads/import-files').then((r) => r.data),
  orderedIds: (params) => api.get('/leads', { params: { ...params, idsOnly: 1 } }).then((r) => r.data),
  exportUrl: () => `${api.defaults.baseURL}/leads/export`,
};