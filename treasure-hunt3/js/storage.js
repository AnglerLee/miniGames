/* ===== storage.js - localStorage Management ===== */

const Storage = {
    KEYS: {
        CONFIG: 'treasureHunt3_config',
        STATE: 'treasureHunt3_state',
        HISTORY: 'treasureHunt3_history',
        ADMIN: 'treasureHunt3_admin'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage.get error:', key, e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage.set error:', key, e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage.remove error:', key, e);
            return false;
        }
    },

    getConfig() {
        return this.get(this.KEYS.CONFIG);
    },

    setConfig(config) {
        return this.set(this.KEYS.CONFIG, config);
    },

    getState() {
        return this.get(this.KEYS.STATE);
    },

    setState(state) {
        return this.set(this.KEYS.STATE, state);
    },

    getAdmin() {
        return this.get(this.KEYS.ADMIN) || { pin: '0000' };
    },

    setAdmin(admin) {
        return this.set(this.KEYS.ADMIN, admin);
    },

    getHistory() {
        return this.get(this.KEYS.HISTORY) || [];
    },

    addHistory(record) {
        const history = this.getHistory();
        history.push(record);
        if (history.length > 50) history.shift();
        return this.set(this.KEYS.HISTORY, history);
    },

    clearState() {
        return this.remove(this.KEYS.STATE);
    }
};
