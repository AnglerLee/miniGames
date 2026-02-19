/* ===== api-client.js - Server API Client ===== */

const ApiClient = {
    async request(url, options) {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                console.error('API error:', res.status, url);
                return null;
            }
            return res.json();
        } catch (e) {
            console.error('API request failed:', url, e.message);
            return null;
        }
    },

    async get(url) {
        return this.request(url);
    },

    async put(url, data) {
        return this.request(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async post(url, data) {
        return this.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async del(url) {
        return this.request(url, { method: 'DELETE' });
    },

    // Config
    async getConfig() { return this.get('/api/config'); },
    async setConfig(config) { return this.put('/api/config', config); },

    // State
    async getState() { return this.get('/api/state'); },
    async setState(state) { return this.put('/api/state', state); },
    async clearState() { return this.del('/api/state'); },

    // Admin
    async getAdmin() {
        const data = await this.get('/api/admin');
        return data || { pin: '0000' };
    },
    async setAdmin(admin) { return this.put('/api/admin', admin); },

    // History
    async getHistory() {
        const data = await this.get('/api/history');
        return data || [];
    },
    async addHistory(record) { return this.post('/api/history', record); },

    // Game Settings
    async getGameSettings(gameId) { return this.get(`/api/games/${gameId}/settings`); },
    async setGameSettings(gameId, settings) { return this.put(`/api/games/${gameId}/settings`, settings); },

    // === Co-op Multiplayer APIs ===

    // Start game (admin)
    async startGame() {
        return this.post('/api/game/start', {});
    },

    // Player join
    async joinGame(name) {
        return this.post('/api/players/join', { name });
    },

    // Get all players
    async getPlayers() {
        return this.get('/api/players');
    },

    // Player heartbeat (includes sessionId for stale-session detection)
    async sendHeartbeat(playerId) {
        const sessionId = Storage.getMySessionId();
        try {
            const res = await fetch(`/api/players/${playerId}/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            if (res.status === 409) {
                // New game session started → signal caller to reset
                return { sessionMismatch: true };
            }
            if (!res.ok) return null;
            return res.json();
        } catch (e) {
            return null;
        }
    },

    // Complete a mission for a player
    async completeMission(missionIndex, playerId, result) {
        return this.post(`/api/missions/${missionIndex}/complete`, {
            playerId,
            result
        });
    },

    // Admin skip mission for a player
    async adminSkipMission(missionIndex, playerId) {
        return this.post('/api/admin/skip-mission', {
            missionIndex,
            playerId
        });
    },

    // File Upload
    async uploadFile(file, gameId, type) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('gameId', gameId);
        formData.append('type', type);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) return null;
            return res.json();
        } catch (e) {
            console.error('Upload failed:', e.message);
            return null;
        }
    }
};
