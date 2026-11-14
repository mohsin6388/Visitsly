import api from './axios.js';

const data = (r) => r.data;

export const conversationApi = {
  list: (params) => api.get('/conversations', { params }).then(data),
  counts: () => api.get('/conversations/counts').then(data),
  get: (id, params) => api.get(`/conversations/${id}`, { params }).then(data),
  sendMessage: (id, text) => api.post(`/conversations/${id}/messages`, { text }).then(data),
  sendMedia: (id, file, caption, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return api
      .post(`/conversations/${id}/media`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
        onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
      })
      .then(data);
  },
  sendPropertyMedia: (id, propertyId, kind) => api.post(`/conversations/${id}/property-media`, { propertyId, kind }).then(data),
  /** Downloads a chat file with the user's auth and returns an object URL. */
  mediaBlob: async (id, messageId, { download = false } = {}) => {
    const res = await api.get(`/conversations/${id}/media/${messageId}`, {
      params: download ? { download: 1 } : {},
      responseType: 'blob',
      timeout: 120000,
    });
    return res.data;
  },
  takeover: (id) => api.post(`/conversations/${id}/takeover`).then(data),
  resumeAI: (id) => api.post(`/conversations/${id}/resume-ai`).then(data),
  markRead: (id) => api.post(`/conversations/${id}/read`).then(data),
  close: (id) => api.post(`/conversations/${id}/close`).then(data),
  reopen: (id) => api.post(`/conversations/${id}/reopen`).then(data),
};
