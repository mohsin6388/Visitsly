/** Agent permission toggles — same keys and defaults as the backend (services/saas/permissions.js). */
export const PERMISSION_GROUPS = [
  {
    key: 'pages', title: 'Pages',
    items: [
      ['dashboard', 'Overview (dashboard)'], ['leads', 'Upload Data (leads)'], ['inbox', 'AI inbox'], ['whatsappLeads', 'WhatsApp leads'],
      ['siteVisits', 'Site visits'], ['followUps', 'Follow-ups'], ['properties', 'Properties'],
    ],
  },
  {
    key: 'actions', title: 'Actions',
    items: [
      ['leadCreate', 'Add a contact'], ['leadImport', 'Upload / import contacts'], ['leadEdit', 'Edit contacts'],
      ['leadDelete', 'Delete contacts'], ['chatReply', 'Reply to chats'],
    ],
  },
  { key: 'phone', title: 'Phone number', items: [['showFullPhone', 'Show full phone number (off = last 4 digits only)']] },
];

export const DEFAULT_AGENT_PERMISSIONS = {
  dashboard: true, leads: true, inbox: true, whatsappLeads: true, siteVisits: true, followUps: true, properties: true,
  leadCreate: true, leadImport: false, leadEdit: true, leadDelete: false, chatReply: true,
  showFullPhone: false,
};

export const PERMISSION_KEYS = Object.keys(DEFAULT_AGENT_PERMISSIONS);
