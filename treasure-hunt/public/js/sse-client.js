/* ===== sse-client.js - Server-Sent Events Client ===== */

const SSEClient = {
    source: null,
    listeners: {},
    reconnectDelay: 3000,
    connected: false,

    connect() {
        if (this.source) {
            this.disconnect();
        }

        this.source = new EventSource('/api/events');

        this.source.addEventListener('connected', () => {
            this.connected = true;
            console.log('[SSE] Connected');
        });

        this.source.addEventListener('config_updated', (e) => {
            try {
                const data = JSON.parse(e.data);
                this._emit('config_updated', data);
            } catch (err) { console.error('[SSE] config parse error:', err); }
        });

        this.source.addEventListener('state_updated', (e) => {
            try {
                const data = JSON.parse(e.data);
                this._emit('state_updated', data);
            } catch (err) { console.error('[SSE] state parse error:', err); }
        });

        this.source.addEventListener('game_reset', (e) => {
            this._emit('game_reset', {});
        });

        this.source.addEventListener('game_settings_updated', (e) => {
            try {
                const data = JSON.parse(e.data);
                this._emit('game_settings_updated', data);
            } catch (err) { console.error('[SSE] game_settings parse error:', err); }
        });

        this.source.onerror = () => {
            this.connected = false;
            console.log('[SSE] Connection lost, auto-reconnecting...');
        };
    },

    disconnect() {
        if (this.source) {
            this.source.close();
            this.source = null;
            this.connected = false;
        }
    },

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    off(event, callback) {
        if (!this.listeners[event]) return;
        if (callback) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        } else {
            delete this.listeners[event];
        }
    },

    _emit(event, data) {
        const callbacks = this.listeners[event];
        if (callbacks) {
            callbacks.forEach(cb => {
                try { cb(data); } catch (e) { console.error('[SSE] Listener error:', e); }
            });
        }
    }
};
