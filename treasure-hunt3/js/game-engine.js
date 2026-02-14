/* ===== game-engine.js - Game State Management ===== */

const GameEngine = {
    config: null,
    state: null,

    init() {
        this.config = Storage.getConfig();
        this.state = Storage.getState();
    },

    hasConfig() {
        return !!this.config;
    },

    hasActiveGame() {
        return this.state && this.state.status === 'playing';
    },

    startNewGame() {
        if (!this.config) return false;

        this.state = {
            status: 'playing',
            currentMissionIndex: 0,
            currentPlayer: 0,
            startedAt: new Date().toISOString(),
            elapsedTime: 0,
            missionResults: [],
            collectedClues: [],
            hintsUsed: {}
        };
        Storage.setState(this.state);
        return true;
    },

    resumeGame() {
        this.state = Storage.getState();
        return this.hasActiveGame();
    },

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

    completeMission(result) {
        if (!this.state) return;

        const mission = this.getCurrentMission();
        if (!mission) return;

        const missionResult = {
            id: mission.id || ('m' + (mission.index + 1)),
            status: 'cleared',
            grade: this._calculateGrade(result),
            attempts: result.attempts || 1,
            time: result.time || 0,
            player: this.state.currentPlayer || 0
        };

        this.state.missionResults.push(missionResult);

        if (mission.clue) {
            this.state.collectedClues.push(mission.clue);
        }

        this.state.currentMissionIndex++;

        // Switch player for 2-player mode (only for minigame, not findObject)
        if (this.getPlayerCount() === 2 && mission.type === 'minigame') {
            this.state.currentPlayer = this.state.currentPlayer === 0 ? 1 : 0;
        }

        this.saveState();
    },

    skipMission() {
        if (!this.state) return;

        const mission = this.getCurrentMission();
        if (!mission) return;

        this.state.missionResults.push({
            id: mission.id || ('m' + (mission.index + 1)),
            status: 'skipped',
            grade: 'F',
            attempts: 0,
            time: 0,
            player: this.state.currentPlayer || 0
        });

        this.state.currentMissionIndex++;

        // Switch player for 2-player mode (only for minigame, not findObject)
        if (this.getPlayerCount() === 2 && mission.type === 'minigame') {
            this.state.currentPlayer = this.state.currentPlayer === 0 ? 1 : 0;
        }

        this.saveState();
    },

    useHint(missionIndex) {
        if (!this.state) return;
        const key = 'm' + missionIndex;
        if (!this.state.hintsUsed[key]) {
            this.state.hintsUsed[key] = 0;
        }
        this.state.hintsUsed[key]++;
        this.saveState();
    },

    getHintsUsed(missionIndex) {
        if (!this.state) return 0;
        return this.state.hintsUsed['m' + missionIndex] || 0;
    },

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

    getResults() {
        if (!this.state) return null;

        const startTime = new Date(this.state.startedAt);
        const totalTime = Math.floor((Date.now() - startTime.getTime()) / 1000);
        const results = this.state.missionResults;
        const cleared = results.filter(r => r.status === 'cleared').length;
        const total = this.config ? this.config.missions.length : 0;
        const totalAttempts = results.reduce((sum, r) => sum + (r.attempts || 0), 0);

        let grade = 'C';
        if (cleared === total && totalAttempts <= total) grade = 'S';
        else if (cleared === total && totalAttempts <= total * 1.5) grade = 'A';
        else if (cleared >= total * 0.8) grade = 'B';

        return {
            totalTime: totalTime,
            cleared: cleared,
            total: total,
            grade: grade,
            totalAttempts: totalAttempts,
            missions: results
        };
    },

    completeGame() {
        if (!this.state) return;
        this.state.status = 'completed';
        this.state.completedAt = new Date().toISOString();
        this.saveState();

        Storage.addHistory({
            theme: this.config.theme,
            preset: this.config.preset || this.config.theme,
            completedAt: this.state.completedAt,
            results: this.getResults()
        });
    },

    resetGame() {
        this.state = null;
        Storage.clearState();
    },

    saveState() {
        if (this.state) {
            Storage.setState(this.state);
        }
    },

    updateElapsedTime(seconds) {
        if (this.state) {
            this.state.elapsedTime = seconds;
            this.saveState();
        }
    },

    /* ===== 2-Player Support ===== */
    getPlayerCount() {
        return (this.config && this.config.playerCount) || 1;
    },

    getPlayers() {
        return (this.config && this.config.players) || [];
    },

    getCurrentPlayerIndex() {
        return (this.state && this.state.currentPlayer) || 0;
    },

    getCurrentPlayerName() {
        if (this.getPlayerCount() < 2) return '';
        const players = this.getPlayers();
        const idx = this.getCurrentPlayerIndex();
        return (players[idx] && players[idx].name) || ('플레이어' + (idx + 1));
    },

    getNextPlayerName() {
        if (this.getPlayerCount() < 2) return '';
        const players = this.getPlayers();
        const idx = this.getCurrentPlayerIndex() === 0 ? 1 : 0;
        return (players[idx] && players[idx].name) || ('플레이어' + (idx + 1));
    },

    getPlayerNameByIndex(playerIdx) {
        const players = this.getPlayers();
        return (players[playerIdx] && players[playerIdx].name) || ('플레이어' + (playerIdx + 1));
    },

    isCoopMission(mission) {
        // findObject missions are played together (co-op), minigames alternate turns
        var m = mission || this.getCurrentMission();
        return m && m.type !== 'minigame';
    },

    _calculateGrade(result) {
        const attempts = result.attempts || 1;
        if (attempts === 1) return 'S';
        if (attempts === 2) return 'A';
        if (attempts === 3) return 'B';
        return 'C';
    }
};
