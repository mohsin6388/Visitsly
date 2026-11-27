import api from "./axios.js";

const data = (r) => r.data;

export const publicApi = {
  plans: (params) => api.get("/public/plans", { params }).then(data),
  geo: () => api.get("/public/geo", { timeout: 2500 }).then(data),
  branding: (host) =>
    api.get("/public/branding", { params: { host } }).then(data),
  formInfo: (key) => api.get(`/inbound/form/${key}`).then(data),
  submitForm: (key, payload) =>
    api.post(`/inbound/leads/${key}`, payload).then(data),
};

export const orgApi = {
  get: () => api.get("/org").then(data),
  update: (payload) => api.patch("/org", payload).then(data),
  onboarding: (payload) => api.patch("/org/onboarding", payload).then(data),
  // Onboarding wizard: final submit + per-step draft (owner only).
  saveProfile: (payload) => api.patch("/org/profile", payload).then(data),
  saveProfileDraft: (payload) =>
    api.patch("/org/profile/draft", payload).then(data),
  whatsapp: () => api.get("/org/whatsapp").then(data),
  connectEmbedded: (payload) =>
    api.post("/org/whatsapp/embedded-signup", payload).then(data),
  prepareEmbeddedSignup: (payload) =>
    api.post("/org/whatsapp/embedded-signup/prepare", payload).then(data),
  completeEmbeddedSignup: (payload) =>
    api.post("/org/whatsapp/embedded-signup/complete", payload).then(data),
  connectManual: (payload) =>
    api.post("/org/whatsapp/manual", payload).then(data),
  disconnectWhatsapp: () => api.post("/org/whatsapp/disconnect").then(data),
  openingTemplate: (payload) =>
    api.patch("/org/whatsapp/opening-template", payload).then(data),
  openingTemplateOptions: (refresh = false) =>
    api
      .get("/org/whatsapp/opening-template/options", {
        params: refresh ? { refresh: "true" } : {},
      })
      .then(data),
  team: () => api.get("/org/team").then(data),
  invite: (payload) => api.post("/org/team", payload).then(data),
  updateMember: (id, payload) =>
    api.patch(`/org/team/${id}`, payload).then(data),
  resetMemberPassword: (id) =>
    api.post(`/org/team/${id}/reset-password`).then(data),
  bulkInvite: (members) => api.post("/org/team/bulk", { members }).then(data),
  setMemberPassword: (id, password) =>
    api.post(`/org/team/${id}/set-password`, { password }).then(data),
  whatsappNumberLabels: () => api.get("/org/whatsapp/number-labels").then(data),
  // phoneNumberId is optional: leave it out for the main number.
  whatsappHealth: (phoneNumberId) =>
    api.get("/org/whatsapp/health", { params: phoneNumberId ? { phoneNumberId } : {} }).then(data),
  fixWhatsappWebhook: (phoneNumberId) =>
    api.post("/org/whatsapp/fix-webhook", null, { params: phoneNumberId ? { phoneNumberId } : {} }).then(data),
  sendWhatsappTestMessage: (payload) =>
    api.post("/org/whatsapp/test-message", payload).then(data),
  retryCoexistenceSync: (phoneNumberId) =>
    api.post(phoneNumberId ? `/org/whatsapp/numbers/${phoneNumberId}/coexistence/sync` : "/org/whatsapp/coexistence/sync").then(data),
};

export const billingApi = {
  get: () => api.get("/billing").then(data),
  quote: (plan, cycle, coupon) =>
    api.get("/billing/quote", { params: { plan, cycle, ...(coupon ? { coupon } : {}) } }).then(data),
  // Checks a coupon on the server → { valid, coupon, quote } (creates / counts nothing).
  validateCoupon: (code, plan, cycle) =>
    api.post("/billing/coupon/validate", { code, plan, cycle }).then(data),
  checkout: (plan, cycle, coupon) =>
    api.post("/billing/checkout", { plan, cycle, ...(coupon ? { coupon } : {}) }).then(data),
  // The Razorpay popup was closed without paying → forget the pending plan.
  checkoutCancel: (payload) => api.post("/billing/checkout/cancel", payload).then(data),
  verify: (payload) => api.post("/billing/verify", payload).then(data),
  verifyOrder: (payload) => api.post("/billing/verify-order", payload).then(data),
  cancel: () => api.post("/billing/cancel").then(data),
  addonCheckout: (addon, quantity) =>
    api.post("/billing/addon-checkout", { addon, quantity }).then(data),
  addonVerify: (payload) =>
    api.post("/billing/addon-verify", payload).then(data),
  // Invoice PDF as a Blob (the axios instance adds the auth token) and "email me a copy".
  invoicePdf: (id) =>
    api.get(`/billing/invoices/${id}/pdf`, { responseType: "blob" }).then((r) => r.data),
  resendInvoice: (id) => api.post(`/billing/invoices/${id}/resend`).then(data),
};

export const budgetApi = {
  get: () => api.get("/reports/budget").then(data),
  update: (payload) => api.patch("/reports/budget", payload).then(data),
  sendReport: () => api.post("/reports/budget/send").then(data),
};

export const growthApi = {
  sources: () => api.get("/org/lead-sources").then(data),
  updateSources: (payload) =>
    api.patch("/org/lead-sources", payload).then(data),
  metaPages: (userAccessToken) =>
    api.post("/org/lead-sources/meta/pages", { userAccessToken }).then(data),
  metaConnect: (payload) =>
    api.post("/org/lead-sources/meta/connect", payload).then(data),
  metaDisconnect: () =>
    api.post("/org/lead-sources/meta/disconnect").then(data),
  routing: () => api.get("/org/routing").then(data),
  updateRouting: (payload) => api.patch("/org/routing", payload).then(data),
  assign: (leadIds, userId) =>
    api.post("/org/routing/assign", { leadIds, userId }).then(data),
  distribute: () => api.post("/org/routing/distribute").then(data),
  weeklyReport: (payload) =>
    api.patch("/org/weekly-report", payload).then(data),
  report: (range) => api.get("/reports", { params: { range } }).then(data),
  requests: () => api.get("/org/requests").then(data),
  request: (payload) => api.post("/org/requests", payload).then(data),
  markBooked: (leadId, payload) =>
    api.post(`/org/deals/${leadId}`, payload).then(data),
  addNumber: (payload) => api.post("/org/whatsapp/numbers", payload).then(data),
  removeNumber: (id) => api.delete(`/org/whatsapp/numbers/${id}`).then(data),
  testLead: (payload) => api.post("/org/lead-sources/test", payload).then(data),
};

export const quoteApi = {
  list: (params) => api.get("/quotes", { params }).then(data),
  preview: (payload) => api.post("/quotes/preview", payload).then(data),
  create: (payload) => api.post("/quotes", payload).then(data),
  remove: (id) => api.delete(`/quotes/${id}`).then(data),
  sendWhatsapp: (id) => api.post(`/quotes/${id}/send-whatsapp`).then(data),
};

export const cpAdminApi = {
  list: () => api.get("/org/channel-partners").then(data),
  settings: (payload) =>
    api.patch("/org/channel-partners/settings", payload).then(data),
  update: (id, payload) =>
    api.patch(`/org/channel-partners/${id}`, payload).then(data),
};

export const voiceApi = {
  settings: () => api.get("/voice/settings").then(data),
  update: (payload) => api.patch("/voice/settings", payload).then(data),
  call: (leadId) => api.post(`/voice/call/${leadId}`).then(data),
  calls: (params) => api.get("/voice/calls", { params }).then(data),
  testCall: (phone, kind = "visit") => api.post("/voice/test-call", { phone, kind }).then(data),
  history: (params) => api.get("/voice/history", { params }).then(data),
  deleteCall: (id) => api.delete(`/voice/history/${id}`).then(data),
  clearHistory: (section) =>
    api.delete("/voice/history", { params: { section } }).then(data),
  leads: (params) => api.get("/voice/leads", { params }).then(data),
  queue: (leadIds) => api.post("/voice/queue", { leadIds }).then(data),
  cancelQueue: (leadIds) =>
    api.post("/voice/queue/cancel", leadIds ? { leadIds } : {}).then(data),
};
