import api from './axios.js';

const data = (r) => r.data;

export const publicApi = {
  plans: () => api.get('/public/plans').then(data),
  branding: (host) => api.get('/public/branding', { params: { host } }).then(data),
  formInfo: (key) => api.get(`/inbound/form/${key}`).then(data),
  submitForm: (key, payload) => api.post(`/inbound/leads/${key}`, payload).then(data),
};

export const orgApi = {
  get: () => api.get('/org').then(data),
  update: (payload) => api.patch('/org', payload).then(data),
  onboarding: (payload) => api.patch('/org/onboarding', payload).then(data),
  whatsapp: () => api.get('/org/whatsapp').then(data),
  connectEmbedded: (payload) => api.post('/org/whatsapp/embedded-signup', payload).then(data),
  prepareEmbeddedSignup: (payload) => api.post('/org/whatsapp/embedded-signup/prepare', payload).then(data),
  completeEmbeddedSignup: (payload) => api.post('/org/whatsapp/embedded-signup/complete', payload).then(data),
  connectManual: (payload) => api.post('/org/whatsapp/manual', payload).then(data),
  disconnectWhatsapp: () => api.post('/org/whatsapp/disconnect').then(data),
  openingTemplate: (payload) => api.patch('/org/whatsapp/opening-template', payload).then(data),
  team: () => api.get('/org/team').then(data),
  invite: (payload) => api.post('/org/team', payload).then(data),
  updateMember: (id, payload) => api.patch(`/org/team/${id}`, payload).then(data),
  resetMemberPassword: (id) => api.post(`/org/team/${id}/reset-password`).then(data),
};

export const billingApi = {
  get: () => api.get('/billing').then(data),
  quote: (plan, cycle) => api.get('/billing/quote', { params: { plan, cycle } }).then(data),
  checkout: (plan, cycle) => api.post('/billing/checkout', { plan, cycle }).then(data),
  verify: (payload) => api.post('/billing/verify', payload).then(data),
  cancel: () => api.post('/billing/cancel').then(data),
};


export const growthApi = {
  sources: () => api.get('/org/lead-sources').then(data),
  updateSources: (payload) => api.patch('/org/lead-sources', payload).then(data),
  metaPages: (userAccessToken) => api.post('/org/lead-sources/meta/pages', { userAccessToken }).then(data),
  metaConnect: (payload) => api.post('/org/lead-sources/meta/connect', payload).then(data),
  metaDisconnect: () => api.post('/org/lead-sources/meta/disconnect').then(data),
  routing: () => api.get('/org/routing').then(data),
  updateRouting: (payload) => api.patch('/org/routing', payload).then(data),
  assign: (leadIds, userId) => api.post('/org/routing/assign', { leadIds, userId }).then(data),
  distribute: () => api.post('/org/routing/distribute').then(data),
  weeklyReport: (payload) => api.patch('/org/weekly-report', payload).then(data),
  report: (range) => api.get('/reports', { params: { range } }).then(data),
  requests: () => api.get('/org/requests').then(data),
  request: (payload) => api.post('/org/requests', payload).then(data),
  markBooked: (leadId, payload) => api.post(`/org/deals/${leadId}`, payload).then(data),
  addNumber: (payload) => api.post('/org/whatsapp/numbers', payload).then(data),
  removeNumber: (id) => api.delete(`/org/whatsapp/numbers/${id}`).then(data),
};

export const quoteApi = {
  list: (params) => api.get('/quotes', { params }).then(data),
  preview: (payload) => api.post('/quotes/preview', payload).then(data),
  create: (payload) => api.post('/quotes', payload).then(data),
  remove: (id) => api.delete(`/quotes/${id}`).then(data),
  sendWhatsapp: (id) => api.post(`/quotes/${id}/send-whatsapp`).then(data),
};

export const cpAdminApi = {
  list: () => api.get('/org/channel-partners').then(data),
  settings: (payload) => api.patch('/org/channel-partners/settings', payload).then(data),
  update: (id, payload) => api.patch(`/org/channel-partners/${id}`, payload).then(data),
};

export const voiceApi = {
  settings: () => api.get('/voice/settings').then(data),
  update: (payload) => api.patch('/voice/settings', payload).then(data),
  call: (leadId) => api.post(`/voice/call/${leadId}`).then(data),
  calls: (params) => api.get('/voice/calls', { params }).then(data),
};
