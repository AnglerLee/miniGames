/* ===== storage.js - Server API Wrapper (replaces localStorage) ===== */

const Storage = {
    // Cache for reducing API calls within same page
    _cache: {},

    async getConfig() {
        const data = await ApiClient.getConfig();
        this._cache.config = data;
        return data;
    },

    async setConfig(config) {
        this._cache.config = config;
        return ApiClient.setConfig(config);
    },

    async getState() {
        const data = await ApiClient.getState();
        this._cache.state = data;
        return data;
    },

    async setState(state) {
        this._cache.state = state;
        return ApiClient.setState(state);
    },

    async getAdmin() {
        return ApiClient.getAdmin();
    },

    async setAdmin(admin) {
        return ApiClient.setAdmin(admin);
    },

    async getHistory() {
        return ApiClient.getHistory();
    },

    async addHistory(record) {
        return ApiClient.addHistory(record);
    },

    async clearState() {
        this._cache.state = null;
        return ApiClient.clearState();
    },

    // Cached sync access (use after initial async load)
    getCachedConfig() {
        return this._cache.config || null;
    },

    getCachedState() {
        return this._cache.state || null;
    }
};
