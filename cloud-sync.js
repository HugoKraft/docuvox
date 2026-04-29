/*
  Cloud-sync placeholder for DocuVox.

  LocalStorage remains the active MVP storage. When Supabase or Firebase is added,
  implement the same async methods below and set enabled: true.
*/
window.docuVoxCloudSync = {
  enabled: false,
  provider: "none",

  async loadDayState() {
    return null;
  },

  async saveDayState(_state) {
    return { ok: false, reason: "Cloud sync is not configured yet." };
  },
};
