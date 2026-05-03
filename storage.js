const DOCUVOX_STORAGE_KEY = "docuvox-day-v2";

window.docuVoxStorage = {
  loadDayState(fallbackFactory) {
    try {
      const saved = JSON.parse(localStorage.getItem(DOCUVOX_STORAGE_KEY));
      if (saved?.patients?.length) return saved;
    } catch {
      return fallbackFactory();
    }
    return fallbackFactory();
  },

  saveDayState(state) {
    localStorage.setItem(DOCUVOX_STORAGE_KEY, JSON.stringify(state));

    if (window.docuVoxCloudSync?.enabled) {
      window.docuVoxCloudSync.saveDayState(state).catch(() => {
        // LocalStorage is the source of truth in test mode.
      });
    }
  },

  clearDayState(fallbackFactory) {
    localStorage.removeItem(DOCUVOX_STORAGE_KEY);
    return fallbackFactory();
  },
};
