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
    },

    // === Local Player Session (localStorage - device-specific) ===

    getMyPlayerId() {
        return localStorage.getItem('treasureHunt_myPlayerId') || null;
    },

    setMyPlayerId(playerId) {
        if (playerId) {
            localStorage.setItem('treasureHunt_myPlayerId', playerId);
        } else {
            localStorage.removeItem('treasureHunt_myPlayerId');
        }
    },

    getMyPlayerName() {
        return localStorage.getItem('treasureHunt_myPlayerName') || null;
    },

    setMyPlayerName(name) {
        if (name) {
            localStorage.setItem('treasureHunt_myPlayerName', name);
        } else {
            localStorage.removeItem('treasureHunt_myPlayerName');
        }
    },

    getMySessionId() {
        return localStorage.getItem('treasureHunt_mySessionId') || null;
    },

    setMySessionId(sessionId) {
        if (sessionId) {
            localStorage.setItem('treasureHunt_mySessionId', sessionId);
        } else {
            localStorage.removeItem('treasureHunt_mySessionId');
        }
    },

    clearMyPlayer() {
        localStorage.removeItem('treasureHunt_myPlayerId');
        localStorage.removeItem('treasureHunt_myPlayerName');
        localStorage.removeItem('treasureHunt_mySessionId');
    }
};
