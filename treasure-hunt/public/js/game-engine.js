/* ===== game-engine.js - Game State Management (Co-op Multiplayer) ===== */

const GameEngine = {
    config: null,
    state: null,

    async init() {
        this.config = await Storage.getConfig();
        this.state = await Storage.getState();
    },

    hasConfig() {
        return !!this.config;
    },

    hasActiveGame() {
        return this.state && (this.state.status === 'playing' || this.state.status === 'waiting_for_players');
    },

    isPlaying() {
        return this.state && this.state.status === 'playing';
    },

    isWaitingForPlayers() {
        return this.state && this.state.status === 'waiting_for_players';
    },

    /* ===== Game Start ===== */
    async startNewGame() {
        if (!this.config) return false;

        // Co-op mode: use server API (admin starts the game)
        if (this.config.gameMode === 'coop' && this.config.playerCount >= 2) {
            const result = await ApiClient.startGame();
            if (result && result.state) {
                this.state = result.state;
                Storage._cache.state = this.state;
                return true;
            }
            return false;
        }

        // Solo mode: create state locally
        this.state = {
            status: 'playing',
            currentMissionIndex: 0,
            startedAt: new Date().toISOString(),
            elapsedTime: 0,
            missionResults: [],
            collectedClues: [],
            hintsUsed: {}
        };
        await Storage.setState(this.state);
        return true;
    },

    async resumeGame() {
        this.state = await Storage.getState();
        return this.hasActiveGame();
    },

    /* ===== Mission Access ===== */
    getCurrentMission() {
        if (!this.config || !this.state) return null;
        const idx = this.state.currentMissionIndex;
        if (idx >= this.config.missions.length) return null;
        const mission = this.config.missions[idx];
        return {
            ...mission,
            index: idx,
            total: this.config.missions.length
        };
    },

    getMissionByIndex(idx) {
        if (!this.config) return null;
        if (idx < 0 || idx >= this.config.missions.length) return null;
        return this.config.missions[idx];
    },

    getCurrentMissionIndex() {
        return (this.state && this.state.currentMissionIndex) || 0;
    },

    /* ===== Co-op Mission Completion ===== */

    /**
     * Complete current mission for a specific player via server API.
     * Server handles all-complete detection and mission advancement.
     * For solo mode (no playerId), updates state directly.
     */
    async completeMission(playerId, result) {
        if (!this.state) return null;

        const missionIndex = this.state.currentMissionIndex;

        // Co-op mode: use server API
        if (playerId && this.getPlayerCount() >= 2) {
            const response = await ApiClient.completeMission(missionIndex, playerId, {
                grade: this._calculateGrade(result),
                attempts: result.attempts || 1,
                time: result.time || 0
            });

            if (response && response.state) {
                this.state = response.state;
                Storage._cache.state = this.state;
            }

            return response;
        }

        // Solo mode: update state locally
        const mission = this.getCurrentMission();
        if (!mission) return null;

        if (!this.state.missionResults) this.state.missionResults = [];
        this.state.missionResults.push({
            id: mission.id || ('m' + (mission.index + 1)),
            status: 'cleared',
            grade: this._calculateGrade(result),
            attempts: result.attempts || 1,
            time: result.time || 0
        });

        if (mission.clue) {
            if (!this.state.collectedClues) this.state.collectedClues = [];
            this.state.collectedClues.push(mission.clue);
        }

        this.state.currentMissionIndex++;
        await this.saveState();

        return { allComplete: false, gameComplete: this.isAllCompleted() };
    },

    async skipMission(playerId) {
        if (!this.state) return null;

        const missionIndex = this.state.currentMissionIndex;

        if (playerId && this.getPlayerCount() >= 2) {
            const response = await ApiClient.adminSkipMission(missionIndex, playerId);
            if (response && response.state) {
                this.state = response.state;
                Storage._cache.state = this.state;
            }
            return response;
        }

        // Solo mode fallback
        const mission = this.getCurrentMission();
        if (!mission) return null;

        if (!this.state.missionResults) this.state.missionResults = [];
        this.state.missionResults.push({
            id: mission.id || ('m' + (mission.index + 1)),
            status: 'skipped',
            grade: 'F',
            attempts: 0,
            time: 0
        });

        this.state.currentMissionIndex++;
        await this.saveState();
        return null;
    },

    /* ===== Player Status ===== */

    /**
     * Get my playerId from localStorage
     */
    getMyPlayerId() {
        return Storage.getMyPlayerId();
    },

    getMyPlayerName() {
        return Storage.getMyPlayerName();
    },

    /**
     * Check if I have completed the current mission
     */
    haveICompleted(playerId) {
        playerId = playerId || this.getMyPlayerId();
        if (!this.state || !this.state.players || !playerId) return false;
        const player = this.state.players[playerId];
        if (!player || !player.missionResults) return false;
        const missionIdx = String(this.state.currentMissionIndex);
        const result = player.missionResults[missionIdx];
        return result && result.status === 'cleared';
    },

    /**
     * Get status of all players for a specific mission
     * Returns: { player0: { name, status, grade }, player1: { ... }, ... }
     */
    getMissionPlayerStatuses(missionIndex) {
        if (!this.state || !this.state.players) return {};

        const statuses = {};
        const idx = String(missionIndex !== undefined ? missionIndex : this.state.currentMissionIndex);

        Object.keys(this.state.players).forEach(pid => {
            const player = this.state.players[pid];
            const result = player.missionResults ? player.missionResults[idx] : null;
            statuses[pid] = {
                name: player.name,
                connected: player.connected,
                status: result ? result.status : 'playing',
                grade: result ? result.grade : null
            };
        });

        return statuses;
    },

    /**
     * Check if all players have completed the current mission
     */
    isCurrentMissionAllComplete() {
        if (!this.state || !this.state.players) return false;
        const idx = String(this.state.currentMissionIndex);

        return Object.keys(this.state.players).every(pid => {
            const player = this.state.players[pid];
            const result = player.missionResults ? player.missionResults[idx] : null;
            return result && result.status === 'cleared';
        });
    },

    /* ===== Player Management ===== */

    getPlayerCount() {
        return (this.config && this.config.playerCount) || 1;
    },

    getPlayers() {
        // Return from state (server-managed players) for co-op mode
        if (this.state && this.state.players) {
            return Object.entries(this.state.players).map(([id, p]) => ({
                id: id,
                name: p.name,
                connected: p.connected
            }));
        }
        // Fallback to config for 1-player mode
        return (this.config && this.config.players) || [];
    },

    getConnectedPlayerCount() {
        if (!this.state || !this.state.players) return 0;
        return Object.values(this.state.players).filter(p => p.connected).length;
    },

    getPlayerNameById(playerId) {
        if (!this.state || !this.state.players) return '';
        const player = this.state.players[playerId];
        return player ? player.name : '';
    },

    /* ===== Game Progress ===== */

    isAllCompleted() {
        if (!this.config || !this.state) return false;
        return this.state.currentMissionIndex >= this.config.missions.length;
    },

    getProgress() {
        if (!this.config || !this.state) return { current: 0, total: 0, percent: 0 };
        const total = this.config.missions.length;
        const current = this.state.currentMissionIndex;
        return {
            current: current,
            total: total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0
        };
    },

    getCollectedClues() {
        return (this.state && this.state.collectedClues) || [];
    },

    getTreasurePassword() {
        return this.config ? this.config.treasurePassword : '';
    },

    getFinalReward() {
        return this.config ? this.config.finalReward : null;
    },

    getTheme() {
        return this.config ? this.config.theme : 'mystery';
    },

    /* ===== Hints ===== */

    async useHint(missionIndex) {
        if (!this.state) return;
        const key = 'm' + missionIndex;
        if (!this.state.hintsUsed) this.state.hintsUsed = {};
        if (!this.state.hintsUsed[key]) {
            this.state.hintsUsed[key] = 0;
        }
        this.state.hintsUsed[key]++;
        await this.saveState();
    },

    getHintsUsed(missionIndex) {
        if (!this.state || !this.state.hintsUsed) return 0;
        return this.state.hintsUsed['m' + missionIndex] || 0;
    },

    /* ===== Results ===== */

    getResults() {
        if (!this.state) return null;

        const startTime = new Date(this.state.startedAt);
        const totalTime = Math.floor((Date.now() - startTime.getTime()) / 1000);
        const totalMissions = this.config ? this.config.missions.length : 0;

        // Solo mode: use missionResults array
        if (!this.state.players) {
            const results = this.state.missionResults || [];
            const cleared = results.filter(r => r.status === 'cleared').length;
            const totalAttempts = results.reduce((sum, r) => sum + (r.attempts || 0), 0);

            let grade = 'C';
            if (cleared === totalMissions && totalAttempts <= totalMissions) grade = 'S';
            else if (cleared === totalMissions && totalAttempts <= totalMissions * 1.5) grade = 'A';
            else if (cleared >= totalMissions * 0.8) grade = 'B';

            return {
                totalTime: totalTime,
                cleared: cleared,
                total: totalMissions,
                grade: grade,
                teamGrade: grade,
                totalAttempts: totalAttempts,
                missions: results,
                playerResults: {}
            };
        }

        // Co-op mode: aggregate per-player results
        const playerResults = {};
        Object.keys(this.state.players).forEach(pid => {
            const player = this.state.players[pid];
            const results = player.missionResults || {};
            let cleared = 0;
            let totalAttempts = 0;
            let totalPlayerTime = 0;

            Object.values(results).forEach(r => {
                if (r && r.status === 'cleared') {
                    cleared++;
                }
                totalAttempts += (r ? r.attempts || 0 : 0);
                totalPlayerTime += (r ? r.time || 0 : 0);
            });

            let grade = 'C';
            if (cleared === totalMissions && totalAttempts <= totalMissions) grade = 'S';
            else if (cleared === totalMissions && totalAttempts <= totalMissions * 1.5) grade = 'A';
            else if (cleared >= totalMissions * 0.8) grade = 'B';

            playerResults[pid] = {
                name: player.name,
                cleared: cleared,
                total: totalMissions,
                grade: grade,
                totalAttempts: totalAttempts,
                totalTime: totalPlayerTime,
                missions: results
            };
        });

        // Overall team grade
        const allCleared = Object.values(playerResults).every(p => p.cleared === totalMissions);
        const teamAttempts = Object.values(playerResults).reduce((sum, p) => sum + p.totalAttempts, 0);
        const playerCount = Object.keys(playerResults).length || 1;
        const avgAttempts = teamAttempts / playerCount;

        let teamGrade = 'C';
        if (allCleared && avgAttempts <= totalMissions) teamGrade = 'S';
        else if (allCleared && avgAttempts <= totalMissions * 1.5) teamGrade = 'A';
        else if (allCleared) teamGrade = 'B';

        return {
            totalTime: totalTime,
            total: totalMissions,
            teamGrade: teamGrade,
            playerResults: playerResults,
            // Legacy compat fields
            cleared: totalMissions,
            grade: teamGrade,
            totalAttempts: teamAttempts,
            missions: []
        };
    },

    /* ===== Game Lifecycle ===== */

    async completeGame() {
        if (!this.state) return;
        this.state.status = 'completed';
        this.state.completedAt = new Date().toISOString();
        await this.saveState();

        await Storage.addHistory({
            theme: this.config.theme,
            preset: this.config.preset || this.config.theme,
            scenarioId: this.config.scenarioId || '',
            completedAt: this.state.completedAt,
            results: this.getResults()
        });
    },

    async resetGame() {
        this.state = null;
        await Storage.clearState();
        Storage.clearMyPlayer();
    },

    async saveState() {
        if (this.state) {
            await Storage.setState(this.state);
        }
    },

    async updateElapsedTime(seconds) {
        if (this.state) {
            this.state.elapsedTime = seconds;
            // Don't save to server for elapsed time updates (too frequent)
        }
    },

    /* ===== Sync from SSE (update in-memory, no save) ===== */

    updateConfig(config) {
        this.config = config;
        Storage._cache.config = config;
    },

    updateState(state) {
        this.state = state;
        Storage._cache.state = state;
    },

    /* ===== Internal ===== */

    _calculateGrade(result) {
        const attempts = result.attempts || 1;
        if (attempts === 1) return 'S';
        if (attempts === 2) return 'A';
        if (attempts === 3) return 'B';
        return 'C';
    }
};
