/* ===== Treasure Hunt - Node.js Server ===== */

const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { readJSON, writeJSON, ensureDir } = require('./utils/file-store');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// ===== Middleware =====
app.use(express.json({ limit: '50mb' }));

// ===== Static Files =====
app.use(express.static(path.join(__dirname, 'public')));
app.use('/games', express.static(path.join(__dirname, '..', 'games')));
// Server-version assets override original assets (common.js, common.css)
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// ===== SSE (Server-Sent Events) =====
const sseClients = new Map(); // playerId -> Set<res>

app.get('/api/events', (req, res) => {
    const playerId = req.query.playerId || 'anonymous';

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    if (!sseClients.has(playerId)) sseClients.set(playerId, new Set());
    sseClients.get(playerId).add(res);

    req.on('close', () => {
        const clients = sseClients.get(playerId);
        if (clients) {
            clients.delete(res);
            if (clients.size === 0) sseClients.delete(playerId);
        }
    });
});

function broadcast(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const [, clients] of sseClients) {
        for (const client of clients) {
            try {
                client.write(message);
            } catch (e) {
                clients.delete(client);
            }
        }
    }
}

// Heartbeat every 30 seconds
setInterval(() => {
    broadcast('heartbeat', { timestamp: Date.now() });
}, 30000);

// ===== State Lock (serialize concurrent writes) =====
let stateLock = Promise.resolve();
function withStateLock(fn) {
    const next = stateLock.then(fn, fn);
    stateLock = next;
    return next;
}

// ===== REST API: Config =====
app.get('/api/config', (req, res) => {
    const config = readJSON('config.json');
    if (!config) return res.json(null);
    res.json(config);
});

app.put('/api/config', (req, res) => {
    const config = req.body;
    if (!config) return res.status(400).json({ error: 'No config data' });
    writeJSON('config.json', config);
    broadcast('config_updated', config);
    res.json({ success: true });
});

// ===== REST API: State =====
app.get('/api/state', (req, res) => {
    const state = readJSON('state.json');
    if (!state) return res.json(null);
    res.json(state);
});

app.put('/api/state', (req, res) => {
    const state = req.body;
    if (!state) return res.status(400).json({ error: 'No state data' });
    writeJSON('state.json', state);
    broadcast('state_updated', state);
    res.json({ success: true });
});

app.delete('/api/state', (req, res) => {
    writeJSON('state.json', null);
    broadcast('game_reset', {});
    res.json({ success: true });
});

// ===== REST API: Co-op Multiplayer =====

// Start game (admin triggers)
app.post('/api/game/start', (req, res) => {
    const config = readJSON('config.json');
    if (!config) return res.status(400).json({ error: 'No config found' });

    const players = {};
    const playerCount = config.playerCount || 1;
    for (let i = 0; i < playerCount; i++) {
        const pid = 'player' + i;
        const name = (config.players && config.players[i]) ? config.players[i].name : ('플레이어' + (i + 1));
        players[pid] = {
            name: name,
            joinedAt: null,
            connected: false,
            lastSeen: null,
            missionResults: {}
        };
    }

    // Generate unique session ID to detect stale player connections
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 8);

    const state = {
        sessionId: sessionId,
        status: playerCount > 1 ? 'waiting_for_players' : 'playing',
        currentMissionIndex: 0,
        startedAt: new Date().toISOString(),
        players: players,
        collectedClues: [],
        hintsUsed: {}
    };

    writeJSON('state.json', state);
    broadcast('game_started', { state });
    res.json({ success: true, state });
});

// Player join (select name)
app.post('/api/players/join', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const state = readJSON('state.json');
    if (!state || !state.players) return res.status(400).json({ error: 'Game not started' });

    // Find matching player slot by name
    let foundPid = null;
    for (const [pid, pdata] of Object.entries(state.players)) {
        if (pdata.name === name) {
            foundPid = pid;
            break;
        }
    }

    if (!foundPid) return res.status(404).json({ error: 'Player name not found' });

    // Mark as joined
    state.players[foundPid].joinedAt = new Date().toISOString();
    state.players[foundPid].connected = true;
    state.players[foundPid].lastSeen = new Date().toISOString();

    // Check if all players joined → start game
    const allJoined = Object.values(state.players).every(p => p.joinedAt);
    if (allJoined && state.status === 'waiting_for_players') {
        state.status = 'playing';
    }

    writeJSON('state.json', state);
    broadcast('player_joined', { playerId: foundPid, name: name, allJoined, state });
    res.json({ success: true, playerId: foundPid, name: name, status: state.status, state });
});

// Get players
app.get('/api/players', (req, res) => {
    const state = readJSON('state.json');
    const config = readJSON('config.json');
    if (!state || !state.players) return res.json({ players: {}, totalExpected: 0 });
    res.json({
        players: state.players,
        totalExpected: config ? (config.playerCount || 1) : 1,
        status: state.status
    });
});

// Player heartbeat
app.post('/api/players/:playerId/heartbeat', (req, res) => {
    const { playerId } = req.params;
    const { sessionId } = req.body;
    const state = readJSON('state.json');
    if (!state || !state.players || !state.players[playerId]) {
        return res.status(404).json({ error: 'Player not found' });
    }

    // Session mismatch → this player belongs to an old game session
    if (state.sessionId && sessionId && state.sessionId !== sessionId) {
        return res.status(409).json({ error: 'Session mismatch', currentSessionId: state.sessionId });
    }

    const wasConnected = state.players[playerId].connected;
    state.players[playerId].connected = true;
    state.players[playerId].lastSeen = new Date().toISOString();
    writeJSON('state.json', state);

    // Broadcast state update only when connection status first changes (for admin dashboard)
    if (!wasConnected) {
        broadcast('state_updated', state);
    }

    res.json({ success: true, sessionId: state.sessionId });
});

// Mission complete (concurrent-safe)
app.post('/api/missions/:missionIndex/complete', async (req, res) => {
    const missionIndex = parseInt(req.params.missionIndex);
    const { playerId } = req.body;
    // result can be nested or flat
    const result = req.body.result || req.body;
    const grade = result.grade;
    const attempts = result.attempts;
    const time = result.time;

    if (!playerId) return res.status(400).json({ error: 'playerId required' });

    try {
        const result = await withStateLock(async () => {
            const state = readJSON('state.json');
            if (!state || !state.players) throw new Error('Game not started');
            if (!state.players[playerId]) throw new Error('Player not found');
            if (missionIndex !== state.currentMissionIndex) {
                throw new Error('Mission index mismatch');
            }

            // Record this player's result
            state.players[playerId].missionResults[String(missionIndex)] = {
                status: 'cleared',
                grade: grade || 'C',
                attempts: attempts || 1,
                time: time || 0
            };

            // Broadcast this player's completion (include state for client sync)
            broadcast('player_mission_complete', {
                playerId,
                missionIndex,
                result: state.players[playerId].missionResults[String(missionIndex)],
                state
            });

            // Check if ALL players completed this mission
            const allComplete = Object.values(state.players).every(p => {
                const r = p.missionResults[String(missionIndex)];
                return r && r.status === 'cleared';
            });

            if (allComplete) {
                // Collect clue from config
                const config = readJSON('config.json');
                const mission = config && config.missions ? config.missions[missionIndex] : null;
                if (mission && mission.clue && mission.clue.content) {
                    state.collectedClues.push(mission.clue.content);
                }

                // Advance to next mission
                state.currentMissionIndex++;

                const totalMissions = config ? config.missions.length : 0;
                const isGameComplete = state.currentMissionIndex >= totalMissions;

                if (isGameComplete) {
                    state.status = 'completed';
                    writeJSON('state.json', state);
                    broadcast('all_missions_complete', { state });
                    return { allComplete: true, gameComplete: true, state };
                } else {
                    writeJSON('state.json', state);
                    broadcast('mission_advance', {
                        nextMissionIndex: state.currentMissionIndex,
                        clue: mission && mission.clue ? mission.clue.content : null,
                        state
                    });
                    return { allComplete: true, gameComplete: false, nextMissionIndex: state.currentMissionIndex, state };
                }
            } else {
                writeJSON('state.json', state);
                return { allComplete: false, state };
            }
        });

        res.json({ success: true, ...result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Admin skip mission for a player
app.post('/api/admin/skip-mission', async (req, res) => {
    const { playerId, missionIndex } = req.body;

    try {
        const result = await withStateLock(async () => {
            const state = readJSON('state.json');
            if (!state || !state.players || !state.players[playerId]) {
                throw new Error('Player not found');
            }

            state.players[playerId].missionResults[String(missionIndex)] = {
                status: 'skipped',
                grade: 'F',
                attempts: 0,
                time: 0
            };

            broadcast('player_mission_complete', {
                playerId,
                missionIndex,
                result: state.players[playerId].missionResults[String(missionIndex)]
            });

            // Check all complete
            const allComplete = Object.values(state.players).every(p => {
                const r = p.missionResults[String(missionIndex)];
                return r && (r.status === 'cleared' || r.status === 'skipped');
            });

            if (allComplete) {
                const config = readJSON('config.json');
                const mission = config && config.missions ? config.missions[missionIndex] : null;
                if (mission && mission.clue && mission.clue.content) {
                    state.collectedClues.push(mission.clue.content);
                }
                state.currentMissionIndex++;

                const totalMissions = config ? config.missions.length : 0;
                if (state.currentMissionIndex >= totalMissions) {
                    state.status = 'completed';
                    writeJSON('state.json', state);
                    broadcast('all_missions_complete', {});
                    return { allComplete: true, gameComplete: true };
                } else {
                    writeJSON('state.json', state);
                    broadcast('mission_advance', {
                        nextMissionIndex: state.currentMissionIndex,
                        clue: mission && mission.clue ? mission.clue.content : null
                    });
                    return { allComplete: true, gameComplete: false };
                }
            } else {
                writeJSON('state.json', state);
                return { allComplete: false };
            }
        });

        res.json({ success: true, ...result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ===== REST API: Admin =====
app.get('/api/admin', (req, res) => {
    const admin = readJSON('admin.json') || { pin: '0000' };
    res.json(admin);
});

app.put('/api/admin', (req, res) => {
    const admin = req.body;
    if (!admin) return res.status(400).json({ error: 'No admin data' });
    writeJSON('admin.json', admin);
    res.json({ success: true });
});

// ===== REST API: History =====
app.get('/api/history', (req, res) => {
    const history = readJSON('history.json') || [];
    res.json(history);
});

app.post('/api/history', (req, res) => {
    const record = req.body;
    if (!record) return res.status(400).json({ error: 'No history record' });
    const history = readJSON('history.json') || [];
    history.push(record);
    if (history.length > 50) history.shift();
    writeJSON('history.json', history);
    res.json({ success: true });
});

// ===== REST API: Game Settings =====
app.get('/api/games/:gameId/settings', (req, res) => {
    const { gameId } = req.params;
    const settings = readJSON(`game-settings/${gameId}.json`);
    if (!settings) return res.json(null);
    res.json(settings);
});

app.put('/api/games/:gameId/settings', (req, res) => {
    const { gameId } = req.params;
    const settings = req.body;
    if (!settings) return res.status(400).json({ error: 'No settings data' });
    ensureDir(path.join(__dirname, 'data', 'game-settings'));
    writeJSON(`game-settings/${gameId}.json`, settings);
    broadcast('game_settings_updated', { gameId, settings });
    res.json({ success: true });
});

// ===== REST API: File Upload =====
const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const gameId = req.body.gameId || 'general';
        const uploadDir = path.join(__dirname, 'data', 'uploads', gameId);
        ensureDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const type = req.body.type || 'file';
        const ext = path.extname(file.originalname) || getExtFromMime(file.mimetype);
        const filename = `${type}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

function getExtFromMime(mime) {
    const map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'audio/webm': '.webm',
        'audio/ogg': '.ogg',
        'audio/mp4': '.m4a',
        'audio/mpeg': '.mp3'
    };
    return map[mime] || '.bin';
}

const upload = multer({
    storage: uploadStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type: ' + file.mimetype));
        }
    }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    const gameId = req.body.gameId || 'general';
    const url = `/uploads/${gameId}/${req.file.filename}`;
    res.json({
        success: true,
        url: url,
        filename: req.file.filename
    });
});

app.delete('/api/upload/:gameId/:filename', (req, res) => {
    const { gameId, filename } = req.params;
    const fs = require('fs');
    const filePath = path.join(__dirname, 'data', 'uploads', gameId, filename);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// ===== Multer error handling =====
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

// ===== Get Local IP =====
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// ===== SSL Certificate (Auto-generate self-signed) =====
async function getSSLCerts() {
    const certDir = path.join(__dirname, 'data', 'ssl');
    const certPath = path.join(certDir, 'cert.pem');
    const keyPath = path.join(certDir, 'key.pem');

    // Return existing certs if available
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };
    }

    // Generate self-signed certificate
    try {
        const selfsigned = require('selfsigned');
        const localIP = getLocalIP();
        const attrs = [{ name: 'commonName', value: 'Treasure Hunt Server' }];
        const pems = await selfsigned.generate(attrs, {
            days: 365,
            keySize: 2048,
            algorithm: 'sha256',
            extensions: [
                { name: 'subjectAltName', altNames: [
                    { type: 2, value: 'localhost' },
                    { type: 7, ip: '127.0.0.1' },
                    { type: 7, ip: localIP }
                ]}
            ]
        });

        ensureDir(certDir);
        fs.writeFileSync(certPath, pems.cert);
        fs.writeFileSync(keyPath, pems.private);
        console.log('   ✅ SSL 인증서 자동 생성 완료');

        return { cert: pems.cert, key: pems.private };
    } catch (e) {
        console.error('   ⚠️  SSL 인증서 생성 실패:', e.message);
        return null;
    }
}

// ===== Start Server =====
async function startServer() {
    const localIP = getLocalIP();
    const mobileUrl = `http://${localIP}:${PORT}`;

    // HTTP Server
    app.listen(PORT, '0.0.0.0', () => {
        console.log('');
        console.log('🏴‍☠️ ========================================= 🏴‍☠️');
        console.log('   Treasure Hunt Server Started!');
        console.log('🏴‍☠️ ========================================= 🏴‍☠️');
        console.log('');
        console.log(`   PC 관리자:      http://localhost:${PORT}/admin.html`);
        console.log(`   모바일 관리자:   ${mobileUrl}/admin.html`);
        console.log(`   모바일 플레이어: ${mobileUrl}`);
        console.log('');
        console.log('   ─────────────────────────────────────────');
        console.log('   📷🎤 모바일 카메라/마이크 활성화 방법:');
        console.log('   ─────────────────────────────────────────');
        console.log('   모바일 Chrome 주소창에 아래 입력:');
        console.log('   chrome://flags/#unsafely-treat-insecure-origin-as-secure');
        console.log('');
        console.log(`   → 입력칸에 ${mobileUrl} 추가`);
        console.log('   → Enabled 선택 → Relaunch 탭');
        console.log('   (한 번만 설정하면 계속 유지됩니다)');
        console.log('');
    });

    // HTTPS Server (fallback for devices that can't use chrome flags)
    const sslCerts = await getSSLCerts();
    if (sslCerts) {
        https.createServer(sslCerts, app).listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`   [HTTPS 대안] https://${localIP}:${HTTPS_PORT}`);
            console.log('   (Chrome 플래그 설정이 어려운 경우 사용)');
            console.log('   (첫 접속 시 "안전하지 않음" → 고급 → 계속하기)');
            console.log('');
        });
    }
}

startServer();
